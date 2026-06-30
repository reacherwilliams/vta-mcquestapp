import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import { findMatchingActiveClaim } from "@/lib/bounties"

function isAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

function canWriteQuestion(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CONTRIBUTOR"
}

export async function GET(req: Request) {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const subjectId = searchParams.get("subjectId")
  const page = Math.max(1, Number(searchParams.get("page") ?? 1))
  const limit = 25

  const where = {
    ...(status ? { status: status as "DRAFT" | "IN_SUBJECT_REVIEW" | "IN_CURRICULUM_REVIEW" | "PUBLISHED" | "ARCHIVED" } : {}),
    ...(subjectId ? { subjectId } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: {
        subject: { select: { name: true } },
        chapter: { select: { name: true } },
        author: { select: { firstName: true, lastName: true } },
        _count: { select: { attempts: true, reports: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.question.count({ where }),
  ])

  return NextResponse.json({ items, total, page, pages: Math.ceil(total / limit) })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!canWriteQuestion(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const body = await req.json()
  const {
    subjectId, chapterId, unitId, topicId,
    year,
    stem, options, explanation,
    difficulty = "MEDIUM",
    allowMultipleCorrect = false,
    tags = [],
    sourceNote,
    aiAssisted = false,
    bountyId: explicitBountyId,
  } = body

  if (!subjectId || !chapterId || !stem || !options?.length) {
    return NextResponse.json({ error: "subjectId, chapterId, stem, and options are required." }, { status: 400 })
  }

  // Auto-attach to a matching active claim if the client didn't pick one.
  const yearInt = year ? Number(year) : null
  const resolvedBountyId =
    explicitBountyId
    ?? (await findMatchingActiveClaim(session!.user!.id, {
      subjectId, chapterId, year: yearInt, difficulty,
    }))

  const question = await prisma.question.create({
    data: {
      subjectId,
      chapterId,
      unitId: unitId ?? null,
      topicId: topicId ?? null,
      year: yearInt,
      stem,
      explanation: explanation ?? [],
      difficulty,
      allowMultipleCorrect,
      tags,
      sourceNote: sourceNote ?? null,
      aiAssisted,
      status: "DRAFT",
      authorId: session!.user!.id,
      bountyId: resolvedBountyId,
      options: {
        create: (options as { content: object; isCorrect: boolean; rationale?: string; sortOrder: number }[]).map((o) => ({
          content: o.content,
          isCorrect: o.isCorrect,
          rationale: o.rationale ?? null,
          sortOrder: o.sortOrder,
        })),
      },
    },
  })

  writeAudit(session!.user!.id, "QUESTION_CREATED", "Question", question.id, {
    subjectId, chapterId, ...(resolvedBountyId ? { bountyId: resolvedBountyId } : {}),
  })

  return NextResponse.json({ id: question.id }, { status: 201 })
}
