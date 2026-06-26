import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  const userId = session.user.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (!user || (user.role !== "CONTRIBUTOR" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Not a contributor." }, { status: 403 })
  }

  const questions = await prisma.question.findMany({
    where: { authorId: userId, status: "PUBLISHED" },
    select: { id: true, stem: true, difficulty: true, chapter: { select: { name: true } } },
  })

  const qIds = questions.map((q) => q.id)

  const [attemptCounts, payouts] = await Promise.all([
    prisma.attempt.groupBy({
      by: ["questionId"],
      where: { questionId: { in: qIds } },
      _count: { questionId: true },
    }),
    prisma.contributorPayout.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, amountCents: true, periodStart: true, periodEnd: true, status: true },
    }),
  ])

  const countMap = new Map(attemptCounts.map((r) => [r.questionId, r._count.questionId]))
  const totalImpressions = [...countMap.values()].reduce((s, c) => s + c, 0)
  const totalPaid = payouts.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amountCents, 0)

  return NextResponse.json({
    publishedCount: questions.length,
    totalImpressions,
    totalPaidCents: totalPaid,
    questions: questions.map((q) => ({
      id: q.id,
      difficulty: q.difficulty,
      chapterName: q.chapter.name,
      impressions: countMap.get(q.id) ?? 0,
    })),
    payouts,
  })
}
