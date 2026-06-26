import "server-only"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

type Props = { params: Promise<{ id: string }> }

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY:      "bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400",
  MEDIUM:    "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  HARD:      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  CHALLENGE: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
}

export default async function SummaryPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const { id: sessionId } = await params

  const ps = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    select: {
      userId: true, mode: true, status: true,
      questionIds: true, startedAt: true, completedAt: true, expiresAt: true,
    },
  })
  if (!ps || ps.userId !== userId) redirect("/practice")

  // Force-complete if somehow still IN_PROGRESS
  if (ps.status === "IN_PROGRESS") {
    await prisma.practiceSession.update({
      where: { id: sessionId },
      data: { status: "COMPLETED", completedAt: new Date() },
    })
  }

  const questionIds = ps.questionIds as string[]

  const [attempts, questions] = await Promise.all([
    prisma.attempt.findMany({
      where: { sessionId, userId },
      select: { questionId: true, isCorrect: true, timeSeconds: true },
    }),
    prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true, difficulty: true,
        subject: { select: { name: true } },
        chapter: { select: { name: true } },
      },
    }),
  ])

  const attemptMap = new Map(attempts.map((a) => [a.questionId, a]))
  const questionMap = new Map(questions.map((q) => [q.id, q]))

  const rows = questionIds.map((qid, i) => {
    const q = questionMap.get(qid)
    const a = attemptMap.get(qid)
    return {
      index: i + 1,
      subject: q?.subject.name ?? "Unknown",
      chapter: q?.chapter.name ?? "",
      difficulty: q?.difficulty ?? "MEDIUM",
      isCorrect: a?.isCorrect ?? null,
      timeSeconds: a?.timeSeconds ?? null,
    }
  })

  const attempted = rows.filter((r) => r.isCorrect !== null).length
  const correct = rows.filter((r) => r.isCorrect === true).length
  const pct = attempted > 0 ? Math.round((correct / attempted) * 100) : 0
  const avgTime = attempted > 0
    ? Math.round(rows.filter((r) => r.timeSeconds !== null).reduce((s, r) => s + (r.timeSeconds ?? 0), 0) / attempted)
    : 0

  const grade = pct >= 80 ? "A" : pct >= 70 ? "B" : pct >= 60 ? "C" : pct >= 50 ? "D" : "U"
  const gradeColor = pct >= 70 ? "text-lime-600 dark:text-lime-400" : pct >= 50 ? "text-amber-500" : "text-rose-500"

  const isExam = ps.mode === "EXAM"

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="h-1 bg-linear-to-r from-orange-500 via-amber-500 to-lime-500" />

      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
            {isExam ? "Exam Complete" : "Session Complete"}
          </p>
          <div className={`text-7xl font-black ${gradeColor}`}>{grade}</div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {correct}/{attempted} correct
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {pct}% · avg {avgTime}s per question
          </p>
        </div>

        {/* Stats grid */}
        <div className="mb-8 grid grid-cols-3 gap-3">
          {[
            { label: "Score", value: `${pct}%` },
            { label: "Correct", value: `${correct}` },
            { label: "Skipped", value: `${questionIds.length - attempted}` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xl font-black text-slate-900 dark:text-slate-100">{value}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Per-question breakdown */}
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Question breakdown</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {rows.map((r, i) => (
            <div
              key={i}
              className={[
                "flex items-center gap-3 px-4 py-3 text-sm",
                i < rows.length - 1 ? "border-b border-slate-100 dark:border-slate-800" : "",
              ].join(" ")}
            >
              <span className="w-6 shrink-0 text-center font-mono text-xs text-slate-400">Q{r.index}</span>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-slate-800 dark:text-slate-200">{r.chapter}</p>
                <p className="text-[11px] text-slate-400">{r.subject}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${DIFFICULTY_COLORS[r.difficulty] ?? ""}`}>
                {r.difficulty}
              </span>
              {r.timeSeconds !== null && (
                <span className="text-xs text-slate-400">{r.timeSeconds}s</span>
              )}
              <span className="text-lg">
                {r.isCorrect === null ? "—" : r.isCorrect ? "✓" : "✗"}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3">
          {isExam && (
            <Link
              href="/practice/exam"
              className="w-full rounded-2xl bg-lime-600 py-3.5 text-center text-sm font-bold text-white transition hover:bg-lime-700"
            >
              Try another exam
            </Link>
          )}
          <Link
            href="/practice"
            className="w-full rounded-2xl border border-slate-200 py-3.5 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Back to practice
          </Link>
        </div>
      </div>
    </div>
  )
}
