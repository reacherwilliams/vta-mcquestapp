import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { LeagueTier } from "@prisma/client"

const TIER_ORDER: LeagueTier[] = ["BRONZE", "SILVER", "GOLD", "DIAMOND", "CHAMPION"]

function weekTag(date: Date): string {
  // ISO week: {year}-W{week}
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

function weekBounds(date: Date): { startsAt: Date; endsAt: Date } {
  const d = new Date(date)
  const day = d.getUTCDay() || 7 // 1=Mon … 7=Sun
  const mon = new Date(d)
  mon.setUTCDate(d.getUTCDate() - (day - 1))
  mon.setUTCHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setUTCDate(mon.getUTCDate() + 7)
  return { startsAt: mon, endsAt: sun }
}

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  const userId = session.user.id
  const now = new Date()
  const tag = weekTag(now)

  // Find the user's current membership (any open league)
  const existing = await prisma.leagueMembership.findFirst({
    where: { userId, league: { endsAt: { gt: now } } },
    include: { league: { select: { tier: true, weekTag: true } } },
  })
  if (existing) {
    return NextResponse.json({ leagueId: existing.leagueId, tier: existing.league.tier, alreadyJoined: true })
  }

  // Determine the tier this user should join: find their last finished league
  const lastMembership = await prisma.leagueMembership.findFirst({
    where: {
      userId,
      league: { endsAt: { lte: now } },
      promoted: { not: null },
    },
    orderBy: { league: { endsAt: "desc" } },
    include: { league: { select: { tier: true } } },
  })

  let tier: LeagueTier = "BRONZE"
  if (lastMembership) {
    const idx = TIER_ORDER.indexOf(lastMembership.league.tier)
    if (lastMembership.promoted === true && idx < TIER_ORDER.length - 1) {
      tier = TIER_ORDER[idx + 1]
    } else if (lastMembership.promoted === false && idx > 0) {
      tier = TIER_ORDER[idx - 1]
    } else {
      tier = lastMembership.league.tier
    }
  }

  const { startsAt, endsAt } = weekBounds(now)

  // Upsert the league for this tier + week, then join it
  const league = await prisma.league.upsert({
    where: { tier_weekTag: { tier, weekTag: tag } },
    create: { tier, weekTag: tag, startsAt, endsAt },
    update: {},
    select: { id: true, tier: true },
  })

  const membership = await prisma.leagueMembership.create({
    data: { leagueId: league.id, userId, weeklyXp: 0 },
    select: { id: true },
  })

  return NextResponse.json({ leagueId: league.id, tier: league.tier, membershipId: membership.id }, { status: 201 })
}
