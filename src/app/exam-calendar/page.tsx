import "server-only"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

export const metadata = { title: "Exam Calendar" }

const CURRICULUM_COLORS: Record<string, string> = {
  IGCSE:    "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  AS_LEVEL: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  A2_LEVEL: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  IB_DP:    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  AP:       "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
}

export default async function ExamCalendarPage() {
  const entries = await prisma.examCalendarEntry.findMany({
    where: { examDate: { gte: new Date() } },
    orderBy: { examDate: "asc" },
    take: 30,
    select: {
      id: true,
      title: true,
      examDate: true,
      region: true,
      notes: true,
      curriculum: { select: { code: true, displayName: true } },
    },
  })

  const now = new Date()

  const grouped = entries.reduce<Record<string, typeof entries>>((acc, e) => {
    const month = new Date(e.examDate).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    if (!acc[month]) acc[month] = []
    acc[month].push(e)
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/practice" className="text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
          ← Practice
        </Link>
        <span className="text-slate-200 dark:text-slate-700">/</span>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Exam Calendar</span>
      </div>

      <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Exam Calendar</h1>
      <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
        Upcoming international exam sessions across all supported curricula.
      </p>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-slate-400">No upcoming exam sessions found.</p>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([month, items]) => (
            <section key={month}>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {month}
              </h2>
              <div className="space-y-2">
                {items.map((e) => {
                  const daysUntil = Math.ceil((new Date(e.examDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  const colorCls = CURRICULUM_COLORS[e.curriculum.code] ?? "bg-slate-100 text-slate-600"
                  return (
                    <div
                      key={e.id}
                      className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                      {/* Date pill */}
                      <div className="flex shrink-0 flex-col items-center rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
                        <span className="text-lg font-black leading-none text-slate-900 dark:text-slate-100">
                          {new Date(e.examDate).getDate()}
                        </span>
                        <span className="text-[10px] font-semibold uppercase text-slate-400">
                          {new Date(e.examDate).toLocaleDateString("en-GB", { month: "short" })}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${colorCls}`}>
                            {e.curriculum.displayName}
                          </span>
                          {e.region !== "Global" && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              {e.region}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{e.title}</p>
                        {e.notes && (
                          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{e.notes}</p>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <p className={`text-sm font-bold tabular-nums ${daysUntil <= 30 ? "text-rose-500" : daysUntil <= 90 ? "text-amber-500" : "text-slate-400"}`}>
                          {daysUntil}d
                        </p>
                        <p className="text-[10px] text-slate-400">away</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* AP FRQ disclaimer */}
      <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          <strong className="text-slate-700 dark:text-slate-300">AP note:</strong> AP exams include both multiple-choice (MCQ) and free-response (FRQ) sections. MCQ MasterLoop covers the MCQ section only. Practice FRQ separately using official College Board materials.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          <strong className="text-slate-700 dark:text-slate-300">IB note:</strong> IB exams include Paper 1 (MCQ for some subjects), Paper 2, and Paper 3 (HL). MCQ MasterLoop focuses on MCQ-style questions across both SL and HL content.
        </p>
      </div>
    </div>
  )
}
