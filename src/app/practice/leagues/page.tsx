import "server-only"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { BottomNav } from "../BottomNav"
import Link from "next/link"
import { LeagueClient } from "./LeagueClient"

export const metadata = { title: "Leagues" }

const TIER_LABELS: Record<string, string> = {
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  DIAMOND: "Diamond",
  CHAMPION: "Champion",
}

const TIER_COLORS: Record<string, { badge: string; glow: string }> = {
  BRONZE:   { badge: "bg-amber-700 text-amber-100",   glow: "shadow-amber-700/20"  },
  SILVER:   { badge: "bg-slate-400 text-white",        glow: "shadow-slate-400/20"  },
  GOLD:     { badge: "bg-yellow-500 text-yellow-950",  glow: "shadow-yellow-500/20" },
  DIAMOND:  { badge: "bg-sky-400 text-sky-950",        glow: "shadow-sky-400/20"    },
  CHAMPION: { badge: "bg-lime-500 text-lime-950",      glow: "shadow-lime-500/20"   },
}

export default async function LeaguesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const now = new Date()

  // Current membership
  const membership = await prisma.leagueMembership.findFirst({
    where: { userId, league: { endsAt: { gt: now } } },
    include: {
      league: {
        include: {
          members: {
            orderBy: { weeklyXp: "desc" },
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
    },
  })

  // Last week's result
  const lastMembership = await prisma.leagueMembership.findFirst({
    where: {
      userId,
      league: { endsAt: { lte: now } },
      promoted: { not: null },
    },
    orderBy: { league: { endsAt: "desc" } },
    include: { league: { select: { tier: true } } },
  })

  if (!membership) {
    // Not in a league — show join screen
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
        <div className="h-1 bg-linear-to-r from-orange-500 via-amber-500 to-lime-500" />
        <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur dark:border-slate-900 dark:bg-slate-950/95">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-4 px-6 py-3 sm:px-10">
            <Link href="/practice" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-2xl font-light leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">←</Link>
            <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Leagues</h1>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-6 pb-28 sm:px-10">
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 text-5xl">🏆</div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">Weekly Leagues</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Earn XP each day and climb the leaderboard. Top 10 get promoted every Sunday.
            </p>
            {lastMembership && (
              <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                Last week: {TIER_LABELS[lastMembership.league.tier]} —{" "}
                {lastMembership.promoted === true
                  ? <span className="text-lime-600 dark:text-lime-400">Promoted!</span>
                  : lastMembership.promoted === false
                    ? <span className="text-rose-500">Relegated</span>
                    : <span>Same tier</span>}
              </p>
            )}
            <LeagueClient mode="join" />
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  const { league } = membership
  const members = league.members
  const myRank = members.findIndex((m) => m.userId === userId) + 1
  const myXp = membership.weeklyXp
  const tierColors = TIER_COLORS[league.tier] ?? TIER_COLORS.BRONZE

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <div className="h-1 bg-linear-to-r from-orange-500 via-amber-500 to-lime-500" />

      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur dark:border-slate-900 dark:bg-slate-950/95">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-6 py-3 sm:px-10">
          <div className="flex items-center gap-4">
            <Link href="/practice" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-2xl font-light leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">←</Link>
            <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Leagues</h1>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold shadow-sm ${tierColors.badge} ${tierColors.glow}`}>
            {TIER_LABELS[league.tier]}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-6 sm:px-6">
        {/* My rank + countdown */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Your rank</p>
            <p className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">#{myRank}</p>
            <p className="text-xs text-slate-400">{myXp} XP this week</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Resets in</p>
            <LeagueClient mode="countdown" endsAt={league.endsAt.toISOString()} />
          </div>
        </div>

        {/* Promotion / demotion zones */}
        <div className="mb-2 flex gap-2 text-[11px] font-semibold">
          <span className="flex items-center gap-1 text-lime-600 dark:text-lime-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3"><polyline points="18 15 12 9 6 15"/></svg>
            Top {Math.min(10, members.length)} promoted
          </span>
          <span className="ml-auto flex items-center gap-1 text-rose-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3"><polyline points="6 9 12 15 18 9"/></svg>
            Bottom {Math.min(5, Math.max(0, members.length - 10))} relegated
          </span>
        </div>

        {/* Leaderboard */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {members.map((m, i) => {
            const rank = i + 1
            const isMe = m.userId === userId
            const isPromotion = rank <= 10
            const isRelegation = rank > members.length - 5 && members.length > 15
            return (
              <div
                key={m.id}
                className={[
                  "flex items-center gap-3 px-4 py-3 text-sm",
                  isMe ? "bg-lime-50 dark:bg-lime-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/30",
                  i < members.length - 1 ? "border-b border-slate-100 dark:border-slate-800" : "",
                  isPromotion ? "border-l-2 border-l-lime-400" : isRelegation ? "border-l-2 border-l-rose-400" : "border-l-2 border-l-transparent",
                ].join(" ")}
              >
                <span className={`w-6 shrink-0 text-center font-mono text-xs font-bold ${rank <= 3 ? "text-amber-500" : "text-slate-400"}`}>
                  {rank <= 3 ? ["🥇","🥈","🥉"][rank - 1] : `#${rank}`}
                </span>
                <span className={`flex-1 font-medium ${isMe ? "text-lime-700 dark:text-lime-300" : "text-slate-800 dark:text-slate-200"}`}>
                  {m.user.firstName} {m.user.lastName[0]}.
                  {isMe && <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-lime-500">You</span>}
                </span>
                <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {m.weeklyXp} XP
                </span>
              </div>
            )
          })}
          {members.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">No members yet this week.</p>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
