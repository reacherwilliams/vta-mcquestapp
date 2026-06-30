import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const metadata = { title: "Admin — Dashboard" }

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
  )
}

export default async function AdminDashboard() {
  const session = await auth()
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
    unresolvedReports,
    pendingReview,
  ] = await Promise.all([
    prisma.question.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.user.count(),
    prisma.attempt.findMany({ where: { createdAt: { gte: dayAgo } },   select: { userId: true }, distinct: ["userId"] }),
    prisma.attempt.findMany({ where: { createdAt: { gte: weekAgo } },  select: { userId: true }, distinct: ["userId"] }),
    prisma.attempt.findMany({ where: { createdAt: { gte: monthAgo } }, select: { userId: true }, distinct: ["userId"] }),
    prisma.attempt.count(),
    prisma.subjectProgress.groupBy({
      by: ["subjectId"],
      _sum: { attempted: true },
      orderBy: { _sum: { attempted: "desc" } },
      take: 5,
    }),
    prisma.questionReport.count({ where: { resolved: false } }),
    prisma.question.findMany({
      where: { status: { in: ["DRAFT", "IN_SUBJECT_REVIEW", "IN_CURRICULUM_REVIEW"] } },
      include: { subject: { select: { name: true } }, chapter: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ])

  const qCounts = Object.fromEntries(questionsByStatus.map((r) => [r.status, r._count.id]))
  const totalQ = Object.values(qCounts).reduce((s, v) => s + v, 0)

  const subjectIds = topSubjects.map((s) => s.subjectId)
  const subjectNames = await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
    select: { id: true, name: true },
  })
  const nameById = Object.fromEntries(subjectNames.map((s) => [s.id, s.name]))

  const STATUS_BADGE: Record<string, string> = {
    DRAFT:                "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    IN_SUBJECT_REVIEW:    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    IN_CURRICULUM_REVIEW: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
    IN_QA:                "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400",
    PUBLISHED:            "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    ARCHIVED:             "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  }
  const STATUS_LABEL: Record<string, string> = {
    DRAFT:                "Draft",
    IN_SUBJECT_REVIEW:    "Subject Review",
    IN_CURRICULUM_REVIEW: "Curriculum Review",
    IN_QA:                "QA Testing",
    PUBLISHED:            "Published",
    ARCHIVED:             "Archived",
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Welcome back, {session?.user?.firstName ?? "Admin"}.
        </p>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total users"    value={totalUsers}      />
        <StatCard label="DAU"            value={dau.length}      sub="active today" />
        <StatCard label="WAU"            value={wau.length}      sub="active this week" />
        <StatCard label="Total attempts" value={totalAttempts.toLocaleString()} />
      </div>

      {/* Questions breakdown */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Published"  value={qCounts.PUBLISHED  ?? 0} />
        <StatCard label="In review"  value={(qCounts.IN_SUBJECT_REVIEW ?? 0) + (qCounts.IN_CURRICULUM_REVIEW ?? 0)} />
        <StatCard label="Draft"      value={qCounts.DRAFT      ?? 0} />
        <StatCard label="Total Q"    value={totalQ} sub={unresolvedReports > 0 ? `${unresolvedReports} unresolved reports` : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Moderation queue */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Moderation queue</h2>
            <Link href="/admin/questions" className="text-xs font-semibold text-lime-700 hover:underline dark:text-lime-400">
              View all →
            </Link>
          </div>
          {pendingReview.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400 dark:border-slate-700">
              Queue is clear 🎉
            </div>
          ) : (
            <div className="space-y-2">
              {pendingReview.map((q) => (
                <Link
                  key={q.id}
                  href={`/admin/questions/${q.id}/edit`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {q.subject.name} — {q.chapter.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {q.difficulty} · {new Date(q.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_BADGE[q.status] ?? ""}`}>
                    {STATUS_LABEL[q.status] ?? q.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Top subjects by attempts */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Top subjects by attempts</h2>
          {topSubjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400 dark:border-slate-700">
              No attempt data yet
            </div>
          ) : (
            <div className="space-y-3">
              {topSubjects.map((s, i) => {
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

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/questions/new"
          className="rounded-xl border-b-4 border-lime-700 bg-lime-500 px-5 py-2.5 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2"
        >
          + New question
        </Link>
        <Link
          href="/admin/import"
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Bulk import
        </Link>
        <Link
          href="/admin/users"
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Manage users
        </Link>
      </div>
    </div>
  )
}
