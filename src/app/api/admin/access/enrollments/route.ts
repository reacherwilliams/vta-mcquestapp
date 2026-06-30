import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFounderTier } from "@/lib/permissions"
import { writeAudit } from "@/lib/audit"

// Look up a student by email + return their enrollments and the full subject
// catalogue (for the grant picker).
export async function GET(req: Request) {
  const session = await auth()
  if (!isFounderTier(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase()
  if (!email) return NextResponse.json({ error: "email is required." }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
  })
  if (!user) return NextResponse.json({ error: "No user with that email." }, { status: 404 })

  const [enrollments, subjects] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId: user.id },
      select: {
        id: true, subjectId: true, status: true, source: true, startedAt: true, expiresAt: true,
        subject: { select: { name: true, syllabusCode: true, code: true, curriculum: { select: { code: true } } } },
      },
      orderBy: { startedAt: "desc" },
    }),
    prisma.subject.findMany({
      where: { isActive: true },
      select: { id: true, name: true, syllabusCode: true, code: true, curriculum: { select: { code: true, displayName: true } } },
      orderBy: [{ curriculum: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
  ])

  return NextResponse.json({ user, enrollments, subjects })
}

// Grant (or re-activate) one or more subject enrollments for a student.
export async function POST(req: Request) {
  const session = await auth()
  if (!isFounderTier(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  let body: { userId?: string; subjectIds?: string[]; source?: string; expiresAt?: string | null }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  const { userId, subjectIds, source = "COMP", expiresAt } = body
  if (!userId || !subjectIds?.length) {
    return NextResponse.json({ error: "userId and subjectIds are required." }, { status: 400 })
  }
  if (!["TRIAL", "PAID", "COMP"].includes(source)) {
    return NextResponse.json({ error: "Invalid source." }, { status: 400 })
  }

  const expiry = expiresAt ? new Date(expiresAt) : null
  const grantedById = source === "COMP" ? session!.user!.id : null

  // Upsert each subject so re-granting re-activates an expired enrollment.
  await prisma.$transaction(
    subjectIds.map((subjectId) =>
      prisma.enrollment.upsert({
        where: { userId_subjectId: { userId, subjectId } },
        create: { userId, subjectId, status: "ACTIVE", source: source as "TRIAL" | "PAID" | "COMP", expiresAt: expiry, grantedById },
        update: { status: "ACTIVE", source: source as "TRIAL" | "PAID" | "COMP", expiresAt: expiry, grantedById },
      }),
    ),
  )

  writeAudit(session!.user!.id, "ENROLLMENTS_GRANTED", "User", userId, { subjectIds, source, expiresAt: expiry })
  return NextResponse.json({ ok: true, granted: subjectIds.length })
}
