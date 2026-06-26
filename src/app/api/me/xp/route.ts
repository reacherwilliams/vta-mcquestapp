import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { levelProgress } from "@/lib/xp"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  const userId = session.user.id

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [todayRows, totalRows, streak, prefs] = await Promise.all([
    prisma.xpLedger.findMany({
      where: { userId, createdAt: { gte: todayStart } },
      select: { delta: true },
    }),
    prisma.xpLedger.findMany({
      where: { userId },
      select: { delta: true },
    }),
    prisma.streak.findUnique({ where: { userId } }),
    prisma.userPreferences.findUnique({ where: { userId }, select: { dailyXpGoal: true } }),
  ])

  const todayXp = todayRows.reduce((s, r) => s + r.delta, 0)
  const totalXp  = totalRows.reduce((s, r) => s + r.delta, 0)
  const { level, xpIntoLevel, xpForLevel, pct } = levelProgress(totalXp)

  return NextResponse.json({
    todayXp,
    totalXp,
    level,
    xpIntoLevel,
    xpForLevel,
    levelPct: pct,
    dailyXpGoal: prefs?.dailyXpGoal ?? 20,
    streak: {
      current: streak?.current ?? 0,
      longest: streak?.longest ?? 0,
    },
  })
}
