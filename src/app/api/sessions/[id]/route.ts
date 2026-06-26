import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type RouteCtx = { params: Promise<{ id: string }> }

/** Force-complete a session (called when exam timer expires). */
export async function PATCH(req: Request, { params }: RouteCtx) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { id } = await params
  const ps = await prisma.practiceSession.findUnique({
    where: { id },
    select: { userId: true, status: true },
  })
  if (!ps || ps.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }
  if (ps.status === "COMPLETED") {
    return NextResponse.json({ ok: true }) // already done
  }

  await prisma.practiceSession.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}

/** Summary data: all attempts for a session with question details. */
export async function GET(req: Request, { params }: RouteCtx) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { id } = await params
  const ps = await prisma.practiceSession.findUnique({
    where: { id },
    select: {
      userId: true,
      mode: true,
      status: true,
      questionIds: true,
      startedAt: true,
      completedAt: true,
      expiresAt: true,
    },
  })
  if (!ps || ps.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  const questionIds = ps.questionIds as string[]

  const [attempts, questions] = await Promise.all([
    prisma.attempt.findMany({
      where: { sessionId: id, userId: session.user.id },
      select: { questionId: true, isCorrect: true, timeSeconds: true, selectedOptionId: true },
    }),
    prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true,
        stem: true,
        difficulty: true,
        subject: { select: { name: true } },
        chapter: { select: { name: true } },
        options: {
          select: { id: true, content: true, isCorrect: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
  ])

  const attemptMap = new Map(attempts.map((a) => [a.questionId, a]))
  const questionMap = new Map(questions.map((q) => [q.id, q]))

  const rows = questionIds.map((qid, i) => {
    const q = questionMap.get(qid)
    const a = attemptMap.get(qid)
    return {
      index: i,
      questionId: qid,
      subject: q?.subject.name ?? "",
      chapter: q?.chapter.name ?? "",
      difficulty: q?.difficulty ?? "MEDIUM",
      isCorrect: a?.isCorrect ?? null,
      timeSeconds: a?.timeSeconds ?? null,
      attempted: !!a,
    }
  })

  const attempted = rows.filter((r) => r.attempted).length
  const correct = rows.filter((r) => r.isCorrect).length

  return NextResponse.json({
    sessionId: id,
    mode: ps.mode,
    status: ps.status,
    startedAt: ps.startedAt,
    completedAt: ps.completedAt,
    expiresAt: ps.expiresAt,
    total: questionIds.length,
    attempted,
    correct,
    rows,
  })
}
