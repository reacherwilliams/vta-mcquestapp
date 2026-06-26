import "server-only"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { SquadClient } from "./SquadClient"

export const metadata = { title: "Squad" }

function weekStart(): Date {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(now)
  mon.setUTCDate(now.getUTCDate() + diff)
  mon.setUTCHours(0, 0, 0, 0)
  return mon
}

export default async function SquadPage({
  searchParams,
}: {
  searchParams: Promise<{ join?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id
  const { join: joinCode } = await searchParams

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
    return (
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <Link href="/practice" className="text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
          ← Practice
        </Link>
        <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-slate-100">Squad Mode</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Create or join a squad to compete with friends on a shared weekly XP leaderboard.
        </p>
        <SquadClient mode="none" userId={userId} initialJoinCode={joinCode} />
      </div>
    )
  }

  const wStart = weekStart()
  const memberIds = membership.squad.members.map((m) => m.userId)

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
      image: m.user.image ?? null,
      isLeader: m.isLeader,
      weeklyXp: xpMap.get(m.userId) ?? 0,
      isMe: m.userId === userId,
    }))
    .sort((a, b) => b.weeklyXp - a.weeklyXp)

  const myXp = xpMap.get(userId) ?? 0
  const topXp = members[0]?.weeklyXp ?? 0

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/practice" className="text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
          ← Practice
        </Link>
        <span className="text-slate-200 dark:text-slate-700">/</span>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Squad</span>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{membership.squad.name}</h1>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            {members.length} member{members.length !== 1 ? "s" : ""} · weekly XP race
          </p>
        </div>
        <SquadClient
          mode="member"
          userId={userId}
          squad={membership.squad}
          isLeader={membership.isLeader}
        />
      </div>

      {/* Leaderboard */}
      <div className="space-y-2">
        {members.map((m, i) => {
          const pct = topXp > 0 ? (m.weeklyXp / topXp) * 100 : 0
          return (
            <div
              key={m.userId}
              className={`relative overflow-hidden rounded-2xl border p-4 ${
                m.isMe
                  ? "border-lime-400 bg-lime-50 dark:border-lime-700 dark:bg-lime-950/30"
                  : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              }`}
            >
              {/* XP fill bar behind content */}
              <div
                className="absolute inset-y-0 left-0 bg-lime-100 dark:bg-lime-900/20 rounded-2xl transition-all"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center gap-3">
                <span className={`w-6 shrink-0 text-center text-sm font-bold ${i === 0 ? "text-amber-500" : "text-slate-400 dark:text-slate-500"}`}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </span>
                {m.image ? (
                  <img src={m.image} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {m.firstName[0]}{m.lastName[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {m.firstName} {m.lastName}
                    {m.isMe && <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span>}
                    {m.isLeader && <span className="ml-1.5 text-xs text-amber-500">👑</span>}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-lime-600 dark:text-lime-400">
                  {m.weeklyXp.toLocaleString()} XP
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* My stats summary */}
      <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          You&apos;ve earned{" "}
          <strong className="text-slate-700 dark:text-slate-300">{myXp.toLocaleString()} XP</strong> this week.
          {topXp > myXp && (
            <> {(topXp - myXp).toLocaleString()} XP behind the leader.</>
          )}
          {topXp === myXp && myXp > 0 && <> You&apos;re leading the squad!</>}
        </p>
      </div>
    </div>
  )
}
