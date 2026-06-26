import "server-only"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

export const metadata = { title: "Calibration" }

export default async function CalibrationPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const attempts = await prisma.attempt.findMany({
    where: { userId, confidence: { not: null } },
    select: { isCorrect: true, confidence: true },
  })

  if (!attempts.length) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Link href="/profile" className="text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">← Profile</Link>
        <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-slate-100">Calibration Score</h1>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          No confidence data yet — rate your confidence after answering to see how well-calibrated you are.
        </p>
      </div>
    )
  }

  // Group by confidence level
  const groups: Record<string, { total: number; correct: number }> = {
    high: { total: 0, correct: 0 },
    medium: { total: 0, correct: 0 },
    low: { total: 0, correct: 0 },
  }
  for (const a of attempts) {
    const lvl = a.confidence as string
    if (!groups[lvl]) continue
    groups[lvl].total++
    if (a.isCorrect) groups[lvl].correct++
  }

  // Calibration score: perfect calibration = high→100%, medium→~60%, low→~30%
  // We measure deviation from ideal
  const IDEAL = { high: 0.9, medium: 0.6, low: 0.3 }
  let totalDeviation = 0
  let counted = 0
  for (const [lvl, { total, correct }] of Object.entries(groups)) {
    if (total === 0) continue
    const actual = correct / total
    const ideal = IDEAL[lvl as keyof typeof IDEAL] ?? 0.6
    totalDeviation += Math.abs(actual - ideal) * total
    counted += total
  }
  const calibrationScore = counted > 0 ? Math.round(Math.max(0, 100 - (totalDeviation / counted) * 100)) : 0

  const LEVEL_LABELS: Record<string, { label: string; idealPct: string }> = {
    high:   { label: "🟢 High",   idealPct: "90%" },
    medium: { label: "🟡 Medium", idealPct: "60%" },
    low:    { label: "🔴 Low",    idealPct: "30%" },
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <Link href="/profile" className="text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">← Profile</Link>
        <span className="text-slate-200 dark:text-slate-700">/</span>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Calibration</span>
      </div>

      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Calibration Score</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          How well your confidence matches your accuracy
        </p>
        <div className={`mt-4 text-6xl font-black ${calibrationScore >= 80 ? "text-lime-600 dark:text-lime-400" : calibrationScore >= 60 ? "text-amber-500" : "text-rose-500"}`}>
          {calibrationScore}
        </div>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">out of 100 — {attempts.length} rated answers</p>
      </div>

      <div className="space-y-4">
        {Object.entries(groups).map(([lvl, { total, correct }]) => {
          const pct = total > 0 ? Math.round((correct / total) * 100) : null
          const { label, idealPct } = LEVEL_LABELS[lvl]!
          return (
            <div key={lvl} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{label}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{total} answers · ideal {idealPct}</span>
              </div>
              {pct !== null ? (
                <>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-lime-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-right text-sm font-bold text-slate-700 dark:text-slate-300">{pct}% correct</p>
                </>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500">No data yet</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          <strong className="text-slate-700 dark:text-slate-300">Well-calibrated</strong> means: when you say "High", you&apos;re right ~90% of the time. When you say "Low", ~30%. Overconfidence (High but often wrong) and underconfidence (Low but often right) both reduce your score.
        </p>
      </div>
    </div>
  )
}
