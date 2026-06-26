import "server-only"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { MarathonClient } from "./MarathonClient"
import type { ContentBlock } from "@/lib/questions/types"

export const metadata = { title: "Past Paper Marathon" }

export default async function MarathonPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const now = new Date()
  const event = await prisma.marathonEvent.findFirst({
    where: { startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      title: true,
      questionIds: true,
      startsAt: true,
      endsAt: true,
    },
  })

  if (!event) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <Link href="/practice" className="text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
          ← Practice
        </Link>
        <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-slate-100">Past Paper Marathon</h1>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-4xl">🏁</p>
          <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-300">No active marathon right now</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Marathons are limited-time events where everyone answers the same questions. Check back soon!
          </p>
        </div>
      </div>
    )
  }

  const dbQuestions = await prisma.question.findMany({
    where: { id: { in: event.questionIds } },
    select: {
      id: true,
      stem: true,
      explanation: true,
      difficulty: true,
      options: {
        select: { id: true, content: true, isCorrect: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  // Preserve event order and cast JSON fields
  const qMap = new Map(dbQuestions.map((q) => [q.id, q]))
  const questions = event.questionIds
    .map((id) => qMap.get(id))
    .filter((q): q is NonNullable<typeof q> => q != null)
    .map((q) => ({
      id: q.id,
      difficulty: q.difficulty,
      stem: q.stem as ContentBlock[],
      explanation: q.explanation as ContentBlock[] | null,
      options: q.options.map((o) => ({
        id: o.id,
        content: o.content as ContentBlock,
        isCorrect: o.isCorrect,
      })),
    }))

  const entry = await prisma.marathonEntry.findUnique({
    where: { eventId_userId: { eventId: event.id, userId } },
    select: { score: true, xpEarned: true, finishedAt: true },
  })

  const answeredAttempts = await prisma.attempt.findMany({
    where: { userId, questionId: { in: event.questionIds }, createdAt: { gte: event.startsAt } },
    select: { questionId: true },
    orderBy: { createdAt: "asc" },
  })
  const answeredIds = [...new Set(answeredAttempts.map((a) => a.questionId))]

  const leaderboard = await prisma.marathonEntry.findMany({
    where: { eventId: event.id },
    orderBy: [{ score: "desc" }, { finishedAt: "asc" }],
    take: 20,
    select: {
      userId: true,
      score: true,
      xpEarned: true,
      finishedAt: true,
      user: { select: { firstName: true, lastName: true, image: true } },
    },
  })

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/practice" className="text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
          ← Practice
        </Link>
        <span className="text-slate-200 dark:text-slate-700">/</span>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Marathon</span>
      </div>

      <MarathonClient
        event={{
          id: event.id,
          title: event.title,
          endsAt: event.endsAt.toISOString(),
          totalQuestions: event.questionIds.length,
        }}
        questions={questions}
        userId={userId}
        initialEntry={entry ? { score: entry.score, xpEarned: entry.xpEarned, finished: !!entry.finishedAt } : null}
        answeredIds={answeredIds}
        initialLeaderboard={leaderboard.map((e, i) => ({
          rank: i + 1,
          userId: e.userId,
          firstName: e.user.firstName,
          lastName: e.user.lastName,
          image: e.user.image ?? null,
          score: e.score,
          xpEarned: e.xpEarned,
          finished: !!e.finishedAt,
          isMe: e.userId === userId,
        }))}
      />
    </div>
  )
}
