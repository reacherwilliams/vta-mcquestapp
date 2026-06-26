import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function weekStart(): Date {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day // Monday
  const mon = new Date(now)
  mon.setUTCDate(now.getUTCDate() + diff)
  mon.setUTCHours(0, 0, 0, 0)
  return mon
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  const userId = session.user.id

  const membership = await prisma.squadMember.findFirst({
    where: { userId },
    select: {
      isLeader: true,
      squad: {
        select: {
          id: true,
          name: true,
          inviteCode: true,
          members: {
            select: {
              userId: true,
              isLeader: true,
              user: { select: { firstName: true, lastName: true, image: true } },
            },
          },
        },
      },
    },
  })

  if (!membership) {
    return NextResponse.json(null)
  }

  const wStart = weekStart()
  const memberIds = membership.squad.members.map((m) => m.userId)

  // Compute weekly XP per member from XpLedger
  const ledgerRows = await prisma.xpLedger.groupBy({
    by: ["userId"],
    where: { userId: { in: memberIds }, createdAt: { gte: wStart } },
    _sum: { delta: true },
  })
  const xpMap = new Map(ledgerRows.map((r) => [r.userId, r._sum.delta ?? 0]))

  const members = membership.squad.members
    .map((m) => ({
      userId: m.userId,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      image: m.user.image,
      isLeader: m.isLeader,
      weeklyXp: xpMap.get(m.userId) ?? 0,
      isMe: m.userId === userId,
    }))
    .sort((a, b) => b.weeklyXp - a.weeklyXp)

  return NextResponse.json({
    squad: {
      id: membership.squad.id,
      name: membership.squad.name,
      inviteCode: membership.squad.inviteCode,
    },
    isLeader: membership.isLeader,
    members,
    weekStart: wStart.toISOString(),
  })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  const userId = session.user.id

  const membership = await prisma.squadMember.findFirst({
    where: { userId },
    select: { id: true, isLeader: true, squadId: true, squad: { select: { _count: { select: { members: true } } } } },
  })
  if (!membership) {
    return NextResponse.json({ error: "Not in a squad." }, { status: 404 })
  }

  // Leader leaving dissolves the squad if they're the last one, or transfers leadership
  if (membership.isLeader) {
    const memberCount = membership.squad._count.members
    if (memberCount === 1) {
      // Delete the whole squad
      await prisma.squad.delete({ where: { id: membership.squadId } })
      return NextResponse.json({ dissolved: true })
    }
    // Transfer leadership to next member
    const next = await prisma.squadMember.findFirst({
      where: { squadId: membership.squadId, userId: { not: userId } },
      orderBy: { joinedAt: "asc" },
    })
    if (next) {
      await prisma.squadMember.update({ where: { id: next.id }, data: { isLeader: true } })
    }
  }

  await prisma.squadMember.delete({ where: { id: membership.id } })
  return NextResponse.json({ left: true })
}
