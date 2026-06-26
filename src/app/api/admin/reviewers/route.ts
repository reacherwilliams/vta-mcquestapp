import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import type { ReviewerScope } from "@prisma/client"

function isAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

// GET /api/admin/reviewers
// → returns all reviewer assignments + the candidate pool of eligible users
// (ADMIN, SUPER_ADMIN, CONTRIBUTOR roles) so the admin UI can offer a picker.
export async function GET() {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const [assignments, candidates] = await Promise.all([
    prisma.reviewerAssignment.findMany({
      include: {
        user:       { select: { id: true, firstName: true, lastName: true, email: true } },
        subject:    { select: { id: true, name: true, code: true, curriculum: { select: { code: true } } } },
        curriculum: { select: { id: true, code: true, displayName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN", "CONTRIBUTOR"] }, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ])

  return NextResponse.json({ assignments, candidates })
}

// POST /api/admin/reviewers
// body: { userId, scope: "SUBJECT" | "CURRICULUM", subjectId?, curriculumId? }
// POST /api/admin/reviewers
// Two body shapes — single (legacy) and batch.
//   single: { userId, scope, subjectId? | curriculumId? }
//   batch:  { userId, scope, ids: string[] }   ← preferred
//
// Batch mode creates N assignments in a single transaction. Existing
// (userId, scope, id) pairs are silently skipped (idempotent), so partial
// re-runs don't fail. Returns { created: <count>, skipped: <count> }.
export async function POST(req: Request) {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const body = await req.json()
  const userId = body.userId as string | undefined
  const scope = body.scope as ReviewerScope | undefined

  if (!userId || !scope || (scope !== "SUBJECT" && scope !== "CURRICULUM")) {
    return NextResponse.json({ error: "userId and scope (SUBJECT|CURRICULUM) are required." }, { status: 400 })
  }

  // Normalise to a list of target IDs regardless of which shape the client sent.
  let ids: string[]
  if (Array.isArray(body.ids)) {
    ids = (body.ids as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0)
  } else if (scope === "SUBJECT" && typeof body.subjectId === "string") {
    ids = [body.subjectId]
  } else if (scope === "CURRICULUM" && typeof body.curriculumId === "string") {
    ids = [body.curriculumId]
  } else {
    return NextResponse.json({ error: `ids (string[]) or ${scope === "SUBJECT" ? "subjectId" : "curriculumId"} required.` }, { status: 400 })
  }

  if (ids.length === 0) {
    return NextResponse.json({ error: "Nothing to assign — select at least one scope." }, { status: 400 })
  }
  if (ids.length > 50) {
    return NextResponse.json({ error: "Cannot assign more than 50 scopes in one request." }, { status: 400 })
  }

  // Confirm the user exists and is eligible.
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true } })
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 })
  if (target.status !== "ACTIVE") {
    return NextResponse.json({ error: "User is not active." }, { status: 400 })
  }
  if (!["ADMIN", "SUPER_ADMIN", "CONTRIBUTOR"].includes(target.role)) {
    return NextResponse.json({ error: "Only contributors or admins can be reviewers." }, { status: 400 })
  }

  // Pre-check which assignments already exist so the audit count is accurate.
  const existing = await prisma.reviewerAssignment.findMany({
    where: {
      userId,
      scope,
      ...(scope === "SUBJECT" ? { subjectId: { in: ids } } : { curriculumId: { in: ids } }),
    },
    select: { subjectId: true, curriculumId: true },
  })
  const existingIds = new Set(existing.map((e) => (scope === "SUBJECT" ? e.subjectId : e.curriculumId)).filter((x): x is string => !!x))
  const newIds = ids.filter((id) => !existingIds.has(id))

  if (newIds.length === 0) {
    return NextResponse.json({ created: 0, skipped: ids.length, message: "All selected scopes were already assigned." })
  }

  const result = await prisma.reviewerAssignment.createMany({
    data: newIds.map((id) => ({
      userId,
      scope,
      subjectId: scope === "SUBJECT" ? id : null,
      curriculumId: scope === "CURRICULUM" ? id : null,
    })),
    skipDuplicates: true,
  })

  writeAudit(session!.user!.id, "USER_ROLE_CHANGED", "ReviewerAssignment", null, {
    assignedUserId: userId, scope, ids: newIds, action: "create_batch",
  })

  return NextResponse.json({ created: result.count, skipped: ids.length - result.count }, { status: 201 })
}
