"use client"

import { useState, useEffect, useCallback } from "react"
import { ContentBlockList, ContentBlockView } from "@/components/questions/content-block"
import type { ContentBlock } from "@/lib/questions/types"

type Question = {
  id: string
  stem: ContentBlock[]
  explanation: ContentBlock[] | null
  difficulty: string
  options: { id: string; content: ContentBlock; isCorrect: boolean }[]
}

type LeaderboardRow = {
  rank: number
  userId: string
  firstName: string
  lastName: string
  image: string | null
  score: number
  xpEarned: number
  finished: boolean
  isMe: boolean
}

type Props = {
  event: { id: string; title: string; endsAt: string; totalQuestions: number }
  questions: Question[]
  userId: string
  initialEntry: { score: number; xpEarned: number; finished: boolean } | null
  answeredIds: string[]
  initialLeaderboard: LeaderboardRow[]
}

export function MarathonClient({
  event,
  questions,
  userId: _userId,
  initialEntry,
  answeredIds,
  initialLeaderboard,
}: Props) {
  const [answered, setAnswered] = useState<Set<string>>(new Set(answeredIds))
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [entry, setEntry] = useState(initialEntry)
  const [leaderboard, setLeaderboard] = useState(initialLeaderboard)
  const [timeLeft, setTimeLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(event.endsAt).getTime() - Date.now()) / 1000)),
  )

  const currentQ = questions.find((q) => !answered.has(q.id)) ?? null
  const finished = !currentQ || entry?.finished

  // Countdown
  useEffect(() => {
    if (timeLeft <= 0) return
    const id = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000)
    return () => clearInterval(id)
  }, [timeLeft])

  // Poll leaderboard every 10 s
  const fetchLeaderboard = useCallback(async () => {
    const res = await fetch(`/api/marathon/${event.id}/leaderboard`)
    if (res.ok) setLeaderboard(await res.json())
  }, [event.id])

  useEffect(() => {
    const id = setInterval(fetchLeaderboard, 10_000)
    return () => clearInterval(id)
  }, [fetchLeaderboard])

  async function submit() {
    if (!currentQ || !selected) return
    const isCorrect = currentQ.options.find((o) => o.id === selected)?.isCorrect ?? false
    setRevealed(true)

    const res = await fetch(`/api/marathon/${event.id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: currentQ.id, isCorrect }),
    })
    if (res.ok) {
      const data = await res.json()
      setEntry((prev) => ({
        score: (prev?.score ?? 0) + (isCorrect ? 1 : 0),
        xpEarned: (prev?.xpEarned ?? 0) + (isCorrect ? 5 : 0),
        finished: data.isFinished,
      }))
      setAnswered((prev) => new Set([...prev, currentQ.id]))
      fetchLeaderboard()
    }
  }

  function next() {
    setSelected(null)
    setRevealed(false)
  }

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}h ${m}m`
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{event.title}</h1>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            {answered.size}/{event.totalQuestions} answered
            {entry && <> · {entry.score} correct · {entry.xpEarned} XP</>}
          </p>
        </div>
        <div
          className={`rounded-xl px-3 py-1.5 text-xs font-bold tabular-nums ${
            timeLeft < 300
              ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          ⏱ {formatTime(timeLeft)}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-lime-500 transition-all"
          style={{ width: `${(answered.size / event.totalQuestions) * 100}%` }}
        />
      </div>

      {/* Question / finish state */}
      {timeLeft === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-3xl">⏰</p>
          <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Time&apos;s up!</p>
          <p className="mt-1 text-xs text-slate-400">
            Final score: {entry?.score ?? 0}/{event.totalQuestions}
          </p>
        </div>
      ) : finished ? (
        <div className="rounded-2xl border border-lime-300 bg-lime-50 p-8 text-center dark:border-lime-800 dark:bg-lime-950/30">
          <p className="text-3xl">🏆</p>
          <p className="mt-3 text-sm font-bold text-lime-700 dark:text-lime-400">Marathon complete!</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Score: {entry?.score}/{event.totalQuestions} · +{entry?.xpEarned} XP earned
          </p>
        </div>
      ) : currentQ ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <ContentBlockList blocks={currentQ.stem} variant="stem" className="mb-4" />

          <div className="space-y-2">
            {currentQ.options.map((opt) => {
              const isSelected = selected === opt.id
              const isCorrectOpt = opt.isCorrect
              let cls =
                "w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors "
              if (!revealed) {
                cls += isSelected
                  ? "border-lime-500 bg-lime-50 text-lime-900 dark:border-lime-600 dark:bg-lime-950/40 dark:text-lime-200"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              } else {
                if (isCorrectOpt) {
                  cls +=
                    "border-lime-500 bg-lime-50 text-lime-900 dark:border-lime-600 dark:bg-lime-950/40 dark:text-lime-200"
                } else if (isSelected && !isCorrectOpt) {
                  cls +=
                    "border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                } else {
                  cls +=
                    "border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                }
              }
              return (
                <button
                  key={opt.id}
                  className={cls}
                  disabled={revealed}
                  onClick={() => setSelected(opt.id)}
                >
                  <ContentBlockView block={opt.content} variant="option" />
                </button>
              )
            })}
          </div>

          {revealed && currentQ.explanation && (
            <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
              <ContentBlockList
                blocks={currentQ.explanation}
                variant="explanation"
              />
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {!revealed ? (
              <button
                onClick={submit}
                disabled={!selected}
                className="flex-1 rounded-xl bg-lime-500 py-3 text-sm font-bold text-white disabled:opacity-40 hover:bg-lime-600"
              >
                Submit
              </button>
            ) : (
              <button
                onClick={next}
                className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-bold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                Next question →
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* Live leaderboard */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Live leaderboard</p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">updates every 10 s</span>
        </div>
        <div className="space-y-1.5">
          {leaderboard.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">No entries yet — be the first!</p>
          ) : (
            leaderboard.map((row) => (
              <div
                key={row.userId}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  row.isMe
                    ? "bg-lime-50 ring-1 ring-lime-400 dark:bg-lime-950/30 dark:ring-lime-700"
                    : "bg-slate-50 dark:bg-slate-800/50"
                }`}
              >
                <span className="w-6 shrink-0 text-center text-xs font-bold text-slate-400">
                  {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : `#${row.rank}`}
                </span>
                {row.image ? (
                  <img src={row.image} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold dark:bg-slate-700">
                    {row.firstName[0]}
                    {row.lastName[0]}
                  </div>
                )}
                <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {row.firstName} {row.lastName}
                  {row.isMe && <span className="ml-1 font-normal text-slate-400"> (you)</span>}
                  {row.finished && <span className="ml-1 text-lime-500">✓</span>}
                </p>
                <span className="shrink-0 text-xs font-bold text-lime-600 dark:text-lime-400">
                  {row.score}/{event.totalQuestions}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
