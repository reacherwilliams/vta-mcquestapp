import "server-only"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { LeagueTier } from "@prisma/client"

/**
 * Vercel Cron — runs Monday 01:00 UTC (after the week has ended at Sunday midnight).
 * vercel.json: { "path": "/api/cron/leagues", "schedule": "0 1 * * 1" }
 *
 * 1. Settle the just-closed week: compute rank, set promoted/demoted flags.
 * 2. Create next week's leagues for every tier that has members (lazy — only if needed).
 */

const TIER_ORDER: LeagueTier[] = ["BRONZE", "SILVER", "GOLD", "DIAMOND", "CHAMPION"]
const PROMOTE_TOP = 10
const DEMOTE_BOTTOM = 5

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const now = new Date()
  // The cron fires Monday — find leagues that ended in the last 24 h
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const closedLeagues = await prisma.league.findMany({
    where: {
      endsAt: { gte: cutoff, lte: now },
    },
    include: {
      members: {
        orderBy: { weeklyXp: "desc" },
        select: { id: true, userId: true, weeklyXp: true },
      },
    },
  })

  let settled = 0

  for (const league of closedLeagues) {
    const members = league.members
    const total = members.length

    for (let i = 0; i < members.length; i++) {
      const rank = i + 1
      const isTop = rank <= PROMOTE_TOP
      const isBottom = rank > total - DEMOTE_BOTTOM && total > PROMOTE_TOP + DEMOTE_BOTTOM

      const promoted = TIER_ORDER.indexOf(league.tier) === TIER_ORDER.length - 1
        ? false // CHAMPION tier — can't promote further
        : isTop
          ? true
          : isBottom && TIER_ORDER.indexOf(league.tier) > 0
            ? false // demoted
            : null  // mid — stays same tier (null = stays, false = demoted)

      await prisma.leagueMembership.update({
        where: { id: members[i].id },
        data: { rank, promoted },
      })
    }
    settled++
  }

  return NextResponse.json({ leaguesSettled: settled })
}
