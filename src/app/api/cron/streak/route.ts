import "server-only"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Vercel Cron — runs nightly at 00:05 UTC.
 * Configured in vercel.json: { "crons": [{ "path": "/api/cron/streak", "schedule": "5 0 * * *" }] }
 *
 * Logic per Streak row:
 *   - lastActiveDate = yesterday  → keep current (already incremented when attempt was recorded)
 *   - lastActiveDate < yesterday  → reset to 0, unless a StreakFreeze is available
 *   - No lastActiveDate           → do nothing (user never practised)
 */
export async function GET(req: Request) {
  // Protect with CRON_SECRET so only Vercel's scheduler can call it
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  const dayBeforeYesterday = new Date(yesterday)
  dayBeforeYesterday.setDate(yesterday.getDate() - 1)

  // Find streaks that were last active before yesterday (missed a day)
  const missedStreaks = await prisma.streak.findMany({
    where: {
      lastActiveDate: { lt: yesterday },
      current: { gt: 0 },
    },
    select: { userId: true, current: true, freezesAvailable: true },
  })

  let frozen = 0
  let reset = 0

  for (const s of missedStreaks) {
    if (s.freezesAvailable > 0) {
      // Consume a freeze: insert StreakFreeze row, decrement counter
      await prisma.$transaction([
        prisma.streakFreeze.create({
          data: { userId: s.userId, usedFor: yesterday },
        }),
        prisma.streak.update({
          where: { userId: s.userId },
          data: { freezesAvailable: { decrement: 1 } },
        }),
      ])
      frozen++
    } else {
      // No freeze — break the streak
      await prisma.streak.update({
        where: { userId: s.userId },
        data: { current: 0 },
      })
      reset++
    }
  }

  // Refill freezes on Mondays (weekTag = 1)
  if (now.getDay() === 1) {
    await prisma.streak.updateMany({
      where: { freezesAvailable: { lt: 1 } },
      data: { freezesAvailable: 1 },
    })
  }

  return NextResponse.json({
    processed: missedStreaks.length,
    frozen,
    reset,
    freezesRefilled: now.getDay() === 1,
  })
}
