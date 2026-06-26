import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminTier } from "@/lib/permissions"

export async function GET() {
  const session = await auth()
  const role = session?.user?.role as string | undefined
  if (!isAdminTier(role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const now = new Date()
  const dayAgo   = new Date(now.getTime() - 86_400_000)
  const weekAgo  = new Date(now.getTime() - 7 * 86_400_000)
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000)

  const [
    questionsByStatus,
    totalUsers,
    dau, wau, mau,
    totalAttempts,
    topSubjects,
    recentReports,
  ] = await Promise.all([
    prisma.question.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.user.count(),
    prisma.attempt.findMany({ where: { createdAt: { gte: dayAgo } },  select: { userId: true }, distinct: ["userId"] }),
    prisma.attempt.findMany({ where: { createdAt: { gte: weekAgo } }, select: { userId: true }, distinct: ["userId"] }),
    prisma.attempt.findMany({ where: { createdAt: { gte: monthAgo }}, select: { userId: true }, distinct: ["userId"] }),
    prisma.attempt.count(),
    prisma.subjectProgress.groupBy({
      by: ["subjectId"],
      _sum: { attempted: true },
      orderBy: { _sum: { attempted: "desc" } },
      take: 5,
    }),
    prisma.questionReport.count({ where: { resolved: false } }),
  ])

  // Resolve subject names for top subjects
  const subjectIds = topSubjects.map((s) => s.subjectId)
  const subjectMap = await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
    select: { id: true, name: true },
  })
  const nameById = Object.fromEntries(subjectMap.map((s) => [s.id, s.name]))

  return NextResponse.json({
    questions: Object.fromEntries(questionsByStatus.map((r) => [r.status, r._count.id])),
    users: { total: totalUsers, dau: dau.length, wau: wau.length, mau: mau.length },
    totalAttempts,
    topSubjects: topSubjects.map((s) => ({
      name: nameById[s.subjectId] ?? s.subjectId,
      attempted: s._sum.attempted ?? 0,
    })),
    unresolvedReports: recentReports,
  })
}
