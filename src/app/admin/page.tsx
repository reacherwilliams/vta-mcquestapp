import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFounderTier } from "@/lib/permissions"
import { getEntitlementGate, getPricingConfig } from "@/lib/entitlements"
import { computeSubjectPrice, formatMoney } from "@/lib/pricing"

export const metadata = { title: "Admin — Dashboard" }

// ── Accent palette (brand: lime-forward, no purple) ──────────────────────────
const ACCENT: Record<string, string> = {
  lime:    "bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400",
  sky:     "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  amber:   "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  rose:    "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  cyan:    "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400",
  slate:   "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
}

function StatCard({
  label, value, sub, delta, accent = "slate", icon,
}: {
  label: string
  value: string | number
  sub?: string
  delta?: string
  accent?: keyof typeof ACCENT | string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${ACCENT[accent] ?? ACCENT.slate}`}>{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{value}</p>
      <div className="mt-0.5 flex items-center gap-2">
        {delta && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{delta}</span>}
        {sub && <span className="text-xs text-slate-500 dark:text-slate-400">{sub}</span>}
      </div>
    </div>
  )
}

// Minimal inline icons
const I = {
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>,
  pulse: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>,
  doc:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
  money: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  flag:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>,
}

export default async function AdminDashboard() {
  const session = await auth()
  const founder = isFounderTier(session?.user?.role)

  const now = new Date()
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0)
  const dayAgo   = new Date(now.getTime() - 86_400_000)
  const weekAgo  = new Date(now.getTime() - 7 * 86_400_000)
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000)

  const [
    questionsByStatus,
    totalUsers, newUsersWeek,
    dau, wau, mau,
    totalAttempts, attemptsToday,
    dailyAttempts,
    topSubjects,
    unresolvedReports, originalsCount,
    pendingReview,
    gate, pricing, activeSubs, trialCount, paidByUser,
  ] = await Promise.all([
    prisma.question.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.attempt.findMany({ where: { createdAt: { gte: dayAgo } },   select: { userId: true }, distinct: ["userId"] }),
    prisma.attempt.findMany({ where: { createdAt: { gte: weekAgo } },  select: { userId: true }, distinct: ["userId"] }),
    prisma.attempt.findMany({ where: { createdAt: { gte: monthAgo } }, select: { userId: true }, distinct: ["userId"] }),
    prisma.attempt.count(),
    prisma.attempt.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.$queryRaw<{ day: string; n: number }[]>`
      SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day, count(*)::int AS n
      FROM attempts WHERE "createdAt" >= ${weekAgo} GROUP BY 1 ORDER BY 1
    `,
    prisma.subjectProgress.groupBy({ by: ["subjectId"], _sum: { attempted: true }, orderBy: { _sum: { attempted: "desc" } }, take: 5 }),
    prisma.questionReport.count({ where: { resolved: false } }),
    prisma.originalQuestion.count(),
    prisma.question.findMany({
      where: { status: { in: ["DRAFT", "IN_SUBJECT_REVIEW", "IN_CURRICULUM_REVIEW"] } },
      include: { subject: { select: { name: true } }, chapter: { select: { name: true } } },
      orderBy: { createdAt: "desc" }, take: 6,
    }),
    getEntitlementGate(),
    getPricingConfig(),
    prisma.subscription.count({ where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } } }),
    prisma.enrollment.count({ where: { source: "TRIAL", status: "ACTIVE", expiresAt: { gt: now } } }),
    prisma.enrollment.groupBy({ by: ["userId"], where: { source: "PAID", status: "ACTIVE" }, _count: { _all: true } }),
  ])

  const qCounts = Object.fromEntries(questionsByStatus.map((r) => [r.status, r._count.id]))
  const totalQ = Object.values(qCounts).reduce((s, v) => s + v, 0)
  const published = qCounts.PUBLISHED ?? 0
  const inReview = (qCounts.IN_SUBJECT_REVIEW ?? 0) + (qCounts.IN_CURRICULUM_REVIEW ?? 0)
  const draft = qCounts.DRAFT ?? 0

  // Est. monthly-equivalent revenue from paid enrollments (volume-priced per user).
  const paidEnrollments = paidByUser.reduce((s, u) => s + u._count._all, 0)
  const mrrCents = paidByUser.reduce((s, u) => s + computeSubjectPrice(pricing, u._count._all, "monthly").totalCents, 0)

  // 7-day attempts series (oldest → newest).
  const byDay = Object.fromEntries(dailyAttempts.map((r) => [r.day, Number(r.n)]))
  const series = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(dayStart.getTime() - (6 - i) * 86_400_000)
    return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-GB", { weekday: "short" }), n: byDay[d.toISOString().slice(0, 10)] ?? 0 }
  })
  const seriesMax = Math.max(1, ...series.map((s) => s.n))

  const subjectIds = topSubjects.map((s) => s.subjectId)
  const subjectNames = await prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } })
  const nameById = Object.fromEntries(subjectNames.map((s) => [s.id, s.name]))

  const STATUS_BADGE: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    IN_SUBJECT_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    IN_CURRICULUM_REVIEW: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
    IN_QA: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400",
    PUBLISHED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    ARCHIVED: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  }
  const STATUS_LABEL: Record<string, string> = {
    DRAFT: "Draft", IN_SUBJECT_REVIEW: "Subject Review", IN_CURRICULUM_REVIEW: "Curriculum Review",
    IN_QA: "QA Testing", PUBLISHED: "Published", ARCHIVED: "Archived",
  }

  const pipeline = [
    { label: "Published", n: published, color: "bg-emerald-500" },
    { label: "In QA", n: qCounts.IN_QA ?? 0, color: "bg-cyan-500" },
    { label: "In review", n: inReview, color: "bg-amber-500" },
    { label: "Draft", n: draft, color: "bg-slate-400" },
  ]
  const pipelineTotal = Math.max(1, pipeline.reduce((s, p) => s + p.n, 0))

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Welcome back, {session?.user?.firstName ?? "Admin"} · {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/questions/new" className="rounded-xl border-b-4 border-lime-700 bg-lime-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2">+ New question</Link>
          <Link href="/admin/qa" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">QA testing</Link>
          <Link href="/admin/coverage" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">Coverage</Link>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total users" value={totalUsers} accent="sky" icon={I.users} delta={newUsersWeek > 0 ? `+${newUsersWeek} this week` : undefined} />
        <StatCard label="Active today" value={dau.length} accent="lime" icon={I.pulse} sub={`${attemptsToday.toLocaleString()} attempts today`} />
        <StatCard label="Published Qs" value={published} accent="emerald" icon={I.doc} sub={`${totalQ} total · ${originalsCount} originals`} />
        {founder
          ? <StatCard label="Est. MRR" value={formatMoney(mrrCents, pricing.currency)} accent="amber" icon={I.money} sub={gate.enabled ? `${paidEnrollments} paid · ${trialCount} on trial` : "gate off"} />
          : <StatCard label="Open reports" value={unresolvedReports} accent={unresolvedReports > 0 ? "rose" : "slate"} icon={I.flag} sub={unresolvedReports > 0 ? "needs attention" : "all clear"} />}
      </div>

      {/* Activity + Pipeline */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 7-day activity */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Attempts · last 7 days</h2>
            <span className="text-xs text-slate-400">{totalAttempts.toLocaleString()} all-time · WAU {wau.length} · MAU {mau.length}</span>
          </div>
          <div className="flex h-28 items-end gap-2">
            {series.map((d) => (
              <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-400">{d.n || ""}</span>
                <div className="flex w-full items-end" style={{ height: "72px" }}>
                  <div className="w-full rounded-t-md bg-lime-500 transition-all" style={{ height: `${Math.max(4, Math.round((d.n / seriesMax) * 72))}px` }} />
                </div>
                <span className="text-[10px] text-slate-400">{d.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Content pipeline */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Content pipeline</h2>
            <Link href="/admin/questions" className="text-xs font-semibold text-lime-700 hover:underline dark:text-lime-400">Manage →</Link>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            {pipeline.map((p) => p.n > 0 && (
              <div key={p.label} className={p.color} style={{ width: `${(p.n / pipelineTotal) * 100}%` }} title={`${p.label}: ${p.n}`} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {pipeline.map((p) => (
              <div key={p.label} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${p.color}`} />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{p.n}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{p.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Monetization — founders only */}
      {founder && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Monetization</h2>
            <Link href="/admin/access" className="text-xs font-semibold text-lime-700 hover:underline dark:text-lime-400">Access &amp; billing →</Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Gate</p>
              <p className={`mt-1 text-lg font-black ${gate.enabled ? "text-lime-600 dark:text-lime-400" : "text-slate-400"}`}>{gate.enabled ? "ON" : "OFF"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Subscriptions</p>
              <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">{activeSubs}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">On trial</p>
              <p className="mt-1 text-lg font-black text-sky-600 dark:text-sky-400">{trialCount}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Paid subjects</p>
              <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">{paidEnrollments}</p>
            </div>
          </div>
          {!gate.enabled && (
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              The entitlement gate is off — students have full access and no charges apply. Turn it on in Access &amp; Billing when ready.
            </p>
          )}
        </section>
      )}

      {/* Moderation + Top subjects */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Moderation queue</h2>
            <Link href="/admin/questions" className="text-xs font-semibold text-lime-700 hover:underline dark:text-lime-400">View all →</Link>
          </div>
          {pendingReview.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400 dark:border-slate-700">Queue is clear 🎉</div>
          ) : (
            <div className="space-y-2">
              {pendingReview.map((q) => (
                <Link key={q.id} href={`/admin/questions/${q.id}/edit`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{q.subject.name} — {q.chapter.name}</p>
                    <p className="text-[11px] text-slate-400">{q.difficulty} · {new Date(q.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_BADGE[q.status] ?? ""}`}>{STATUS_LABEL[q.status] ?? q.status}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Top subjects by attempts</h2>
          {topSubjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400 dark:border-slate-700">No attempt data yet</div>
          ) : (
            <div className="space-y-3">
              {topSubjects.map((s) => {
                const max = topSubjects[0]._sum.attempted ?? 1
                const pct = Math.round(((s._sum.attempted ?? 0) / max) * 100)
                return (
                  <div key={s.subjectId}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{nameById[s.subjectId] ?? "—"}</span>
                      <span className="text-slate-400">{(s._sum.attempted ?? 0).toLocaleString()} attempts</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-lime-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
