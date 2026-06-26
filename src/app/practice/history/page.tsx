import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { BottomNav } from "../BottomNav"

export const metadata = { title: "Session History" }

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function modeLabel(mode: string): string {
  switch (mode) {
    case "WRONG_RETRY": return "Retry"
    case "EXAM": return "Exam"
    case "BOSS": return "Boss"
    default: return "Practice"
  }
}

export default async function HistoryPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/practice/history")
  const userId = session.user.id

  const sessions = await prisma.practiceSession.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take: 40,
    include: {
      attempts: { select: { isCorrect: true } },
    },
  })

  const rows = sessions.map((s) => {
    const total = s.attempts.length
    const correct = s.attempts.filter((a) => a.isCorrect).length
    const pct = total > 0 ? Math.round((correct / total) * 100) : null
    const filter = s.filter as Record<string, unknown>
    return {
      id: s.id,
      mode: s.mode,
      status: s.status,
      startedAt: s.startedAt,
      total,
      correct,
      pct,
      questionCount: (s.questionIds as string[]).length,
    }
  })

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <div className="h-1 bg-linear-to-r from-orange-500 via-amber-500 to-lime-500" />

      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur dark:border-slate-900 dark:bg-slate-950/95">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-6 py-3 sm:px-10">
          <Link
            href="/practice"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-2xl font-light leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ←
          </Link>
          <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Session History
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-28 pt-6 sm:px-10">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="text-5xl">📖</div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              No sessions yet
            </h2>
            <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
              Complete your first practice session and it will appear here.
            </p>
            <Link
              href="/practice/filter"
              className="mt-2 rounded-2xl border-b-4 border-lime-700 bg-lime-500 px-8 py-3 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2"
            >
              Start practicing →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Score ring */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  {row.pct !== null ? (
                    <span
                      className={
                        row.pct >= 80
                          ? "text-sm font-black text-emerald-600 dark:text-emerald-400"
                          : row.pct >= 50
                          ? "text-sm font-black text-amber-600 dark:text-amber-400"
                          : "text-sm font-black text-rose-600 dark:text-rose-400"
                      }
                    >
                      {row.pct}%
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {modeLabel(row.mode)}
                    </span>
                    <span
                      className={
                        row.status === "COMPLETED"
                          ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : row.status === "ABANDONED"
                          ? "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800"
                          : "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                      }
                    >
                      {row.status === "IN_PROGRESS" ? "in progress" : row.status.toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {row.total} of {row.questionCount} answered · {formatDate(row.startedAt)}
                  </p>
                </div>

                {/* Resume link for in-progress sessions */}
                {row.status === "IN_PROGRESS" && (
                  <Link
                    href={`/practice/session/${row.id}`}
                    className="shrink-0 rounded-xl border border-lime-200 bg-lime-50 px-3 py-1.5 text-xs font-bold text-lime-700 transition hover:bg-lime-100 dark:border-lime-900 dark:bg-lime-950/30 dark:text-lime-400"
                  >
                    Resume
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
