import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { levelProgress } from "@/lib/xp"
import { getEntitledSubjectScope, getTrialStatus } from "@/lib/entitlements"
import { cn } from "@/lib/utils"
import { BottomNav } from "./BottomNav"

export const metadata = { title: "Practice" }

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

export default async function PracticeDashboard() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [user, streak, prefs, subjectProgress, lastSession, revisionCount, xpRows, todayXpRows, subscription, todayAttemptCount, weakChapters] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { firstName: true },
      }),
      prisma.streak.findUnique({ where: { userId } }),
      prisma.userPreferences.findUnique({
        where: { userId },
        select: { dailyXpGoal: true, enabledSubjectIds: true },
      }),
      prisma.subjectProgress.findMany({
        where: { userId },
        include: { subject: true },
        orderBy: { lastPracticedAt: "desc" },
        take: 6,
      }),
      prisma.practiceSession.findFirst({
        where: { userId, status: "IN_PROGRESS" },
        orderBy: { startedAt: "desc" },
        select: {
          id: true, mode: true, questionIds: true, currentIndex: true, startedAt: true,
          filter: true,
        },
      }),
      prisma.wrongAnswer.count({ where: { userId, resolvedAt: null } }),
      prisma.xpLedger.findMany({ where: { userId }, select: { delta: true } }),
      prisma.xpLedger.findMany({
        where: { userId, createdAt: { gte: todayStart } },
        select: { delta: true },
      }),
      prisma.subscription.findUnique({ where: { userId }, select: { plan: true } }),
      prisma.attempt.count({ where: { userId, createdAt: { gte: todayStart } } }),
      // Recommended chapters: attempted but <60% mastery, most recently touched first
      prisma.attempt.groupBy({
        by: ["questionId"],
        where: { userId },
        _count: { questionId: true },
        _max: { createdAt: true },
      }).then(async (groups) => {
        if (!groups.length) return []
        const qIds = groups.map((g) => g.questionId)
        const questions = await prisma.question.findMany({
          where: { id: { in: qIds } },
          select: { id: true, chapterId: true, chapter: { select: { id: true, name: true, subject: { select: { name: true } } } } },
        })
        const qMap = new Map(questions.map((q) => [q.id, q]))
        // Aggregate by chapter
        const chapterMap = new Map<string, { chapterId: string; name: string; subject: string; attempted: number; correct: number; lastAt: Date }>()
        const correctSet = new Set((await prisma.attempt.findMany({
          where: { userId, isCorrect: true },
          select: { questionId: true },
        })).map((a) => a.questionId))
        for (const g of groups) {
          const q = qMap.get(g.questionId)
          if (!q) continue
          const key = q.chapterId
          const existing = chapterMap.get(key) ?? { chapterId: key, name: q.chapter.name, subject: q.chapter.subject.name, attempted: 0, correct: 0, lastAt: new Date(0) }
          existing.attempted++
          if (correctSet.has(g.questionId)) existing.correct++
          const lat = g._max.createdAt ?? new Date(0)
          if (lat > existing.lastAt) existing.lastAt = lat
          chapterMap.set(key, existing)
        }
        return [...chapterMap.values()]
          .filter((c) => c.attempted >= 3 && c.correct / c.attempted < 0.6)
          .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
          .slice(0, 3)
          .map((c) => ({ ...c, mastery: Math.round((c.correct / c.attempted) * 100) }))
      }),
    ])

  const plan = subscription?.plan ?? "FREE"
  const FREE_DAILY_LIMIT = 10

  // Entitlement trial status. Only relevant when the gate actually restricts
  // this user (scope !== null means they're gated, not exempt/grandfathered).
  const [entitledScope, trial] = await Promise.all([
    getEntitledSubjectScope(userId, session.user.role as string | undefined),
    getTrialStatus(userId),
  ])
  const isGated = entitledScope !== null
  const trialEnded = isGated && !trial.onTrial && entitledScope.length === 0

  const totalXp   = xpRows.reduce((s, r) => s + r.delta, 0)
  const todayXp   = todayXpRows.reduce((s, r) => s + r.delta, 0)
  const dailyGoal = prefs?.dailyXpGoal ?? 20
  const xpPct     = Math.min(100, Math.round((todayXp / dailyGoal) * 100))
  const { level, xpIntoLevel, xpForLevel } = levelProgress(totalXp)
  const streakCount = streak?.current ?? 0

  // Accent colours per subject (based on subject code heuristic)
  const SUBJECT_ACCENTS: Record<string, { bg: string; text: string; abbr: string }> = {
    PHY:     { bg: "bg-sky-500",    text: "text-sky-700 dark:text-sky-300",    abbr: "P" },
    MATH:    { bg: "bg-lime-500",   text: "text-lime-700 dark:text-lime-300",  abbr: "M" },
    MATH_AA: { bg: "bg-lime-500",   text: "text-lime-700 dark:text-lime-300",  abbr: "M" },
    MATH_AI: { bg: "bg-lime-600",   text: "text-lime-700 dark:text-lime-300",  abbr: "M" },
    CHEM:    { bg: "bg-teal-500",   text: "text-teal-700 dark:text-teal-300",  abbr: "C" },
    BIO:     { bg: "bg-orange-500", text: "text-orange-700 dark:text-orange-300", abbr: "B" },
    BUS:     { bg: "bg-amber-500",  text: "text-amber-700 dark:text-amber-300", abbr: "Bu" },
    CS:      { bg: "bg-rose-500",   text: "text-rose-700 dark:text-rose-300",  abbr: "CS" },
    ECO:     { bg: "bg-green-500",  text: "text-green-700 dark:text-green-300", abbr: "E" },
    GEO:     { bg: "bg-cyan-500",   text: "text-cyan-700 dark:text-cyan-300",  abbr: "G" },
    ENG:     { bg: "bg-amber-600",  text: "text-amber-700 dark:text-amber-300", abbr: "En" },
    STATS:   { bg: "bg-indigo-500", text: "text-indigo-700 dark:text-indigo-300", abbr: "St" },
    CALC_AB: { bg: "bg-lime-500",   text: "text-lime-700 dark:text-lime-300",  abbr: "CA" },
    CALC_BC: { bg: "bg-lime-600",   text: "text-lime-700 dark:text-lime-300",  abbr: "CB" },
    PHY_1:   { bg: "bg-sky-500",    text: "text-sky-700 dark:text-sky-300",    abbr: "P1" },
  }

  const lastSessionTotal = lastSession
    ? (lastSession.questionIds as string[]).length
    : 0

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* Brand strip */}
      <div className="h-1 bg-linear-to-r from-orange-500 via-amber-500 to-lime-500" />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur dark:border-slate-900 dark:bg-slate-950/95">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-3 sm:px-10">
          <span className="text-lg font-black text-slate-900 dark:text-slate-100">
            MCQ<span className="text-lime-600"> MasterLoop</span>
          </span>

          <div className="flex items-center gap-3">
            {/* Streak */}
            {streakCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 dark:bg-orange-950/40">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-orange-500" fill="currentColor">
                  <path d="M12 2C10 7 5 8 5 13a7 7 0 0 0 14 0c0-5-5-6-7-11z" />
                </svg>
                <span className="text-sm font-black text-orange-700 dark:text-orange-400">{streakCount}</span>
              </div>
            )}

            {/* Level badge */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lime-100 dark:bg-lime-950/40">
              <span className="text-xs font-black text-lime-700 dark:text-lime-300">L{level}</span>
            </div>

            {/* Pro upgrade pill (free users only) */}
            {plan === "FREE" && (
              <Link
                href="/pricing"
                className="hidden rounded-full border border-lime-300 bg-lime-50 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-lime-700 transition hover:bg-lime-100 dark:border-lime-700 dark:bg-lime-950/20 dark:text-lime-400 sm:flex"
              >
                Go Pro
              </Link>
            )}

            {/* Avatar */}
            <Link href="/profile" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {user.firstName[0].toUpperCase()}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-6 py-6 pb-28 sm:px-10">

        {/* Entitlement trial banner — shown only while the gate restricts this user */}
        {isGated && trial.onTrial && (
          <Link
            href="/practice/subscribe"
            className="flex items-center justify-between gap-3 rounded-2xl border border-lime-200 bg-lime-50 px-5 py-3.5 transition hover:bg-lime-100 dark:border-lime-800 dark:bg-lime-950/20 dark:hover:bg-lime-950/30"
          >
            <div>
              <p className="text-sm font-bold text-lime-700 dark:text-lime-400">
                {trial.daysLeft} {trial.daysLeft === 1 ? "day" : "days"} left in your free trial
              </p>
              <p className="text-xs text-lime-600 dark:text-lime-500">Subscribe to keep full access to your subjects</p>
            </div>
            <span className="shrink-0 rounded-full bg-lime-500 px-3 py-1 text-xs font-black text-white">Subscribe</span>
          </Link>
        )}
        {trialEnded && (
          <Link
            href="/practice/subscribe"
            className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3.5 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/20 dark:hover:bg-rose-950/30"
          >
            <div>
              <p className="text-sm font-bold text-rose-700 dark:text-rose-400">Your free trial has ended</p>
              <p className="text-xs text-rose-600 dark:text-rose-500">Subscribe to unlock your subjects again</p>
            </div>
            <span className="shrink-0 rounded-full bg-rose-500 px-3 py-1 text-xs font-black text-white">Subscribe</span>
          </Link>
        )}

        {/* Free-tier daily limit banner */}
        {plan === "FREE" && todayAttemptCount >= FREE_DAILY_LIMIT && (
          <Link
            href="/pricing"
            className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/20 dark:hover:bg-amber-950/30"
          >
            <div>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400">You&apos;ve used all 10 free questions today</p>
              <p className="text-xs text-amber-600 dark:text-amber-500">Upgrade to Pro for unlimited access</p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-white">Upgrade</span>
          </Link>
        )}

        {plan === "FREE" && todayAttemptCount < FREE_DAILY_LIMIT && todayAttemptCount > 0 && (
          <Link
            href="/pricing"
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {FREE_DAILY_LIMIT - todayAttemptCount} of {FREE_DAILY_LIMIT} free questions remaining today
            </p>
            <span className="shrink-0 text-xs font-semibold text-lime-600 dark:text-lime-400">Upgrade →</span>
          </Link>
        )}

        {/* Greeting + XP goal */}
        <section>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {greeting()}, {user.firstName}!
          </h1>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-widest">
              <span className="text-slate-500 dark:text-slate-400">
                Daily goal · L{level} ({xpIntoLevel}/{xpForLevel} XP to next)
              </span>
              <span className={xpPct >= 100 ? "text-lime-600 dark:text-lime-400" : "text-slate-600 dark:text-slate-400"}>
                {todayXp} / {dailyGoal} XP
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-lime-500 transition-all duration-500"
                style={{ width: `${xpPct}%` }}
              />
            </div>
            {xpPct >= 100 && (
              <p className="text-xs font-semibold text-lime-600 dark:text-lime-400">
                Daily goal complete! Keep going →
              </p>
            )}
          </div>
        </section>

        {/* Continue last session */}
        {lastSession && (
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Continue where you left off
            </h2>
            <Link
              href={`/practice/session/${lastSession.id}?q=${lastSession.currentIndex}`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {lastSession.mode === "WRONG_RETRY" ? "Revision Deck session" : "Practice session"}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {lastSession.currentIndex} / {lastSessionTotal} questions completed
                </p>
              </div>
              <div className="shrink-0 rounded-xl border-b-2 border-lime-700 bg-lime-500 px-4 py-2 text-xs font-extrabold uppercase tracking-widest text-slate-900">
                Continue →
              </div>
            </Link>
          </section>
        )}

        {/* Subject progress grid */}
        {subjectProgress.length > 0 ? (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Your subjects
              </h2>
              <Link href="/practice/filter" className="text-xs font-semibold text-lime-700 hover:text-lime-900 dark:text-lime-400">
                + Practice
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {subjectProgress.map((sp) => {
                const accent = SUBJECT_ACCENTS[sp.subject.code] ?? { bg: "bg-slate-500", text: "text-slate-600", abbr: sp.subject.code[0] }
                return (
                  <Link
                    key={sp.id}
                    href="/practice/filter"
                    className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white", accent.bg)}>
                        {accent.abbr}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{sp.subject.name}</p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{sp.attempted} answered</p>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Mastery</span>
                        <span className={cn("text-[11px] font-bold", accent.text)}>
                          {Math.round(sp.masteryPercent)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={cn("h-full rounded-full transition-all", accent.bg)}
                          style={{ width: `${sp.masteryPercent}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ) : (
          /* No subject data yet — prompt to start */
          <section className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-300 py-10 text-center dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">No practice data yet.</p>
            <Link
              href="/practice/filter"
              className="rounded-2xl border-b-4 border-lime-700 bg-lime-500 px-6 py-3 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2"
            >
              Start your first session →
            </Link>
          </section>
        )}

        {/* Recommended for you */}
        {weakChapters.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Recommended for you
            </h2>
            <div className="space-y-2">
              {weakChapters.map((c) => (
                <Link
                  key={c.chapterId}
                  href={`/practice/filter?chapterId=${c.chapterId}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 transition hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{c.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{c.subject}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-bold text-rose-500">{c.mastery}%</p>
                      <p className="text-[10px] text-slate-400">mastery</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">Drill →</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Marathon teaser */}
        <section>
          <Link
            href="/practice/marathon"
            className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 transition hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-xl dark:bg-orange-950/30">
                🏁
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Past Paper Marathon</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Limited-time events — answer the same questions as everyone
                </p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-semibold text-slate-400">View →</span>
          </Link>
        </section>

        {/* Squad teaser */}
        <section>
          <Link
            href="/practice/squad"
            className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 transition hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-50 text-xl dark:bg-lime-950/30">
                🤝
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Squad Mode</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Compete with friends on a weekly XP leaderboard
                </p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-semibold text-slate-400">View →</span>
          </Link>
        </section>

        {/* Revision Deck teaser */}
        {revisionCount > 0 && (
          <section>
            <Link
              href="/practice/revision-deck"
              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 transition hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-xl dark:bg-amber-950/30">
                  📋
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Revision Deck</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {revisionCount} {revisionCount === 1 ? "question" : "questions"} to revisit
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold text-slate-400">Review →</span>
            </Link>
          </section>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
