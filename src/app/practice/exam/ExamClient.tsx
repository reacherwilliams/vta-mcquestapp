"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ExamPreset } from "@/lib/sessions/practice"
import { cn } from "@/lib/utils"

type Subject = {
  id: string
  name: string
  curriculum: { displayName: string }
  chapters: { id: string; name: string }[]
}

type Props = {
  presets: ExamPreset[]
  subjects: Subject[]
  isPro: boolean
}

export function ExamClient({ presets, subjects, isPro }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<string>(presets[0].id)
  const [error, setError] = useState<string | null>(null)

  // Custom preset state
  const [customSubjectId, setCustomSubjectId] = useState("")
  const [customChapterId, setCustomChapterId] = useState("")
  const [customMinutes, setCustomMinutes] = useState(30)
  const [customCount, setCustomCount] = useState(20)

  const preset = presets.find((p) => p.id === selected)!
  const isCustom = selected === "custom"
  const customSubject = subjects.find((s) => s.id === customSubjectId)

  function start() {
    if (!isPro) return
    setError(null)
    startTransition(async () => {
      let filter: Record<string, string> = {}
      let durationMinutes = preset.durationMinutes
      let questionCount = preset.questionCount

      if (isCustom) {
        if (!customSubjectId) { setError("Please choose a subject."); return }
        filter = { subjectId: customSubjectId }
        if (customChapterId) filter.chapterId = customChapterId
        durationMinutes = customMinutes
        questionCount = customCount
      } else {
        // Match subject by name + curriculum
        const match = subjects.find(
          (s) =>
            s.name === preset.subjectName &&
            s.curriculum.displayName.toLowerCase().includes(preset.curriculumCode.toLowerCase().replace("_", " ")),
        )
        if (match) filter = { subjectId: match.id }
      }

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "EXAM", filter, durationMinutes, questionCount }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Could not start exam.")
        return
      }
      const { id } = await res.json()
      router.push(`/practice/session/${id}?q=0&style=swiss&exam=1`)
    })
  }

  return (
    <div className="space-y-3">
      {presets.map((p) => (
        <button
          key={p.id}
          onClick={() => setSelected(p.id)}
          className={cn(
            "w-full rounded-2xl border px-5 py-4 text-left transition",
            selected === p.id
              ? "border-lime-500 bg-lime-50 dark:border-lime-600 dark:bg-lime-950/30"
              : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{p.label}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">{p.description}</span>
          </div>
        </button>
      ))}

      {isCustom && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">Subject</label>
            <select
              value={customSubjectId}
              onChange={(e) => { setCustomSubjectId(e.target.value); setCustomChapterId("") }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.curriculum.displayName} — {s.name}</option>
              ))}
            </select>
          </div>
          {customSubject && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">Chapter (optional)</label>
              <select
                value={customChapterId}
                onChange={(e) => setCustomChapterId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">All chapters</option>
                {customSubject.chapters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">Duration (minutes)</label>
              <input
                type="number" min={5} max={180}
                value={customMinutes}
                onChange={(e) => setCustomMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">Questions</label>
              <input
                type="number" min={5} max={80}
                value={customCount}
                onChange={(e) => setCustomCount(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-rose-500">{error}</p>}

      <button
        onClick={start}
        disabled={isPending || !isPro}
        className="mt-2 w-full rounded-2xl bg-lime-600 py-3.5 text-sm font-bold text-white transition hover:bg-lime-700 disabled:opacity-50"
      >
        {isPending ? "Starting exam…" : isPro ? "Start exam" : "Pro required"}
      </button>
    </div>
  )
}
