import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getEntitledSubjectScope, scopeAllows } from "@/lib/entitlements"

type RouteCtx = { params: Promise<{ chapterId: string }> }

/** GET — check if boss is unlocked for this chapter for the current user. */
export async function GET(req: Request, { params }: RouteCtx) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  const userId = session.user.id
  const { chapterId } = await params

  const { unlocked, attempted, total } = await checkBossUnlock(userId, chapterId)
  return NextResponse.json({ unlocked, attempted, total, pct: total > 0 ? Math.round((attempted / total) * 100) : 0 })
}

/** POST — start a Boss session for this chapter. */
export async function POST(req: Request, { params }: RouteCtx) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  const userId = session.user.id
  const { chapterId } = await params

  const { unlocked } = await checkBossUnlock(userId, chapterId)
  if (!unlocked) {
    return NextResponse.json({ error: "Boss not yet unlocked. Attempt ≥80% of chapter questions first." }, { status: 403 })
  }

  // Entitlement check — the chapter's subject must be accessible to this user.
  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId }, select: { subjectId: true } })
  if (!chapter) return NextResponse.json({ error: "Chapter not found." }, { status: 404 })
  const scope = await getEntitledSubjectScope(userId, session.user.role as string | undefined)
  if (!scopeAllows(scope, chapter.subjectId)) {
    return NextResponse.json({ error: "You're not enrolled in this subject." }, { status: 403 })
  }

  // Pick 10 hardest CHALLENGE questions from the chapter
  const questions = await prisma.question.findMany({
    where: { chapterId, status: "PUBLISHED", difficulty: "CHALLENGE" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 10,
  })

  // Fallback: if <10 CHALLENGE, fill with HARD
  if (questions.length < 10) {
    const hardIds = new Set(questions.map((q) => q.id))
    const hard = await prisma.question.findMany({
      where: { chapterId, status: "PUBLISHED", difficulty: "HARD", id: { notIn: [...hardIds] } },
      select: { id: true },
      take: 10 - questions.length,
    })
    questions.push(...hard)
  }

  if (!questions.length) {
    return NextResponse.json({ error: "No CHALLENGE questions available for this chapter yet." }, { status: 400 })
  }

  const ps = await prisma.practiceSession.create({
    data: {
      userId,
      mode: "BOSS",
      filter: { chapterId },
      questionIds: questions.map((q) => q.id),
    },
    select: { id: true },
  })

  return NextResponse.json({ id: ps.id }, { status: 201 })
}

async function checkBossUnlock(userId: string, chapterId: string) {
  const [totalInChapter, attemptedByUser] = await Promise.all([
    prisma.question.count({ where: { chapterId, status: "PUBLISHED" } }),
    prisma.attempt.groupBy({
      by: ["questionId"],
      where: {
        userId,
        question: { chapterId },
      },
    }),
  ])

  const attempted = attemptedByUser.length
  const unlocked = totalInChapter > 0 && attempted / totalInChapter >= 0.8
  return { unlocked, attempted, total: totalInChapter }
}
