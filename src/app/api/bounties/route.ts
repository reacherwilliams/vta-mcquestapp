import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import { canManageBounty, BountyError } from "@/lib/bounties"
import type { BountyStatus, QuestionDifficulty, UserRole } from "@prisma/client"

const VALID_DIFFICULTIES = ["EASY", "MEDIUM", "HARD", "CHALLENGE"]

// GET /api/bounties?status=OPEN&curriculumId=...&subjectId=...&mine=true
//   - Auth: any signed-in user (contributors see open bounties to claim).
//   - status: filter by bounty status (or "active" = OPEN | CLAIMED)
//   - mine=true: only bounties claimed by the current user
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") ?? "active"
  const curriculumId = searchParams.get("curriculumId") ?? undefined
  const subjectId = searchParams.get("subjectId") ?? undefined
  const mine = searchParams.get("mine") === "true"

  const where = {
    ...(status === "active"
      ? { status: { in: ["OPEN", "CLAIMED"] as BountyStatus[] } }
      : status === "all" ? {} : { status: status as BountyStatus }),
    ...(curriculumId ? { curriculumId } : {}),
    ...(subjectId ? { subjectId } : {}),
    ...(mine ? { claimedById: session.user.id } : {}),
  }

  const bounties = await prisma.bounty.findMany({
    where,
    include: {
      curriculum: { select: { code: true, displayName: true } },
      subject:    { select: { code: true, name: true } },
      chapter:    { select: { name: true } },
      createdBy:  { select: { firstName: true, lastName: true } },
      claimedBy:  { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  })

  return NextResponse.json(bounties)
}

// POST /api/bounties
// body: { curriculumId, subjectId, chapterId?, year?, difficulty?, count?, notes? }
// Auth: ADMIN, SUPER_ADMIN, or a CurriculumReviewer for the given curriculum.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 })
  }
  const actor = { id: session.user.id, role: session.user.role as UserRole }

  const body = await req.json()
  const {
    curriculumId, subjectId, chapterId, year, difficulty,
    count = 1, notes,
  } = body

  if (!curriculumId || !subjectId) {
    return NextResponse.json({ error: "curriculumId and subjectId are required." }, { status: 400 })
  }
  if (difficulty && !VALID_DIFFICULTIES.includes(difficulty)) {
    return NextResponse.json({ error: `difficulty must be one of: ${VALID_DIFFICULTIES.join(", ")}` }, { status: 400 })
  }
  if (typeof count !== "number" || count < 1 || count > 100) {
    return NextResponse.json({ error: "count must be between 1 and 100." }, { status: 400 })
  }

  try {
    if (!(await canManageBounty(actor, curriculumId))) {
      throw new BountyError("You are not a curriculum reviewer for this curriculum.", 403)
    }

    // Verify subject belongs to curriculum.
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId }, select: { curriculumId: true },
    })
    if (!subject || subject.curriculumId !== curriculumId) {
      return NextResponse.json({ error: "Subject does not belong to the given curriculum." }, { status: 400 })
    }

    const bounty = await prisma.bounty.create({
      data: {
        curriculumId, subjectId,
        chapterId: chapterId ?? null,
        year: year ? Number(year) : null,
        difficulty: (difficulty as QuestionDifficulty) ?? null,
        count, filledCount: 0,
        notes: notes?.trim() || null,
        createdById: actor.id,
      },
    })

    writeAudit(actor.id, "BOUNTY_CREATED", "Bounty", bounty.id, {
      curriculumId, subjectId, count,
    })

    return NextResponse.json(bounty, { status: 201 })
  } catch (err) {
    if (err instanceof BountyError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
