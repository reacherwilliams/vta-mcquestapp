"use client"

import { createPortal } from "react-dom"
import { useState } from "react"

const CATEGORIES = [
  { key: "bug",              label: "Something is broken" },
  { key: "bad_answer",       label: "Wrong answer marked correct" },
  { key: "bad_explanation",  label: "Explanation is incorrect / unclear" },
  { key: "copyright",        label: "Possible copyright issue" },
  { key: "other",            label: "Other" },
] as const

type Props = {
  questionId: string
  onClose: () => void
}

export function ReportModal({ questionId, onClose }: Props) {
  const [category, setCategory] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    if (!category) return
    setSubmitting(true)
    setError("")
    const res = await fetch(`/api/questions/${questionId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, notes }),
    })
    setSubmitting(false)
    if (res.ok) {
      setDone(true)
      setTimeout(onClose, 1400)
    } else {
      const d = await res.json()
      setError(d.error ?? "Failed to submit report.")
    }
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="py-4 text-center">
            <p className="text-2xl">✓</p>
            <p className="mt-2 font-semibold text-slate-700 dark:text-slate-300">Report submitted — thanks!</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 dark:text-slate-200">Report this question</h2>
              <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              {CATEGORIES.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className={[
                    "w-full rounded-xl px-4 py-2.5 text-left text-sm transition",
                    category === key
                      ? "bg-lime-50 text-lime-700 ring-2 ring-lime-400 dark:bg-lime-950/20 dark:text-lime-400"
                      : "border border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details (optional)…"
              rows={3}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-lime-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            />

            {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={!category || submitting}
                onClick={submit}
                className="flex-1 rounded-xl border-b-4 border-lime-700 bg-lime-500 py-2 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
              <button type="button" onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
