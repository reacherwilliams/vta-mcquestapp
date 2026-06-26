"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"

type Curriculum = { id: string; code: string; displayName: string }
type Subject    = { id: string; name: string; code: string; curriculumId: string }
type Chapter    = { id: string; name: string; subjectId: string }

type Bounty = {
  id: string
  count: number
  filledCount: number
  year: number | null
  difficulty: string | null
  notes: string | null
  status: string
  createdAt: Date
  curriculum: { code: string }
  subject:    { name: string }
  chapter:    { name: string } | null
  claimedBy:  { firstName: string; lastName: string } | null
}

type Props = {
  curricula: Curriculum[]
  subjects:  Subject[]
  chapters:  Chapter[]
  bounties:  Bounty[]
}

const DIFFICULTIES = ["EASY", "MEDIUM", "HARD", "CHALLENGE"] as const
const STATUS_BADGE: Record<string, string> = {
  OPEN:      "bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400",
  CLAIMED:   "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  FULFILLED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  CLOSED:    "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
}

export function ReviewBountiesClient({ curricula, subjects, chapters, bounties }: Props) {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  const yearOptions = useMemo(
    () => Array.from({ length: currentYear + 1 - 2015 + 1 }, (_, i) => currentYear + 1 - i),
    [currentYear],
  )

  const [curriculumId, setCurriculumId] = useState(curricula[0]?.id ?? "")
  const [subjectId,    setSubjectId]    = useState("")
  const [chapterId,    setChapterId]    = useState("")
  const [year,         setYear]         = useState<number | "">("")
  const [difficulty,   setDifficulty]   = useState<string>("")
  const [count,        setCount]        = useState(1)
  const [notes,        setNotes]        = useState("")
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const subjectsInCurr = subjects.filter((s) => s.curriculumId === curriculumId)
  const chaptersInSub  = chapters.filter((c) => c.subjectId === subjectId)

  async function handleCreate() {
    setError(null); setSaving(true)
    try {
      const res = await fetch("/api/bounties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curriculumId, subjectId,
          chapterId: chapterId || null,
          year: year || null,
          difficulty: difficulty || null,
          count,
          notes,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Could not create bounty.")
        return
      }
      // Reset form
      setSubjectId(""); setChapterId(""); setYear(""); setDifficulty(""); setCount(1); setNotes("")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(id: string, status: "OPEN" | "CLOSED") {
    await fetch(`/api/bounties/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    router.refresh()
  }

  const canSubmit = !!curriculumId && !!subjectId && count > 0

  return (
    <div className="space-y-8">
      {/* Create form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Post a new bounty</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Scope it tightly so contributors know exactly what to write. Leave optional fields blank to mean &quot;any&quot;.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Curriculum">
            <select
              value={curriculumId}
              onChange={(e) => { setCurriculumId(e.target.value); setSubjectId(""); setChapterId("") }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {curricula.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.displayName}</option>
              ))}
            </select>
          </Field>

          <Field label="Subject *">
            <select
              value={subjectId}
              onChange={(e) => { setSubjectId(e.target.value); setChapterId("") }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">Choose…</option>
              {subjectsInCurr.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>

          <Field label="Chapter (any)">
            <select
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              disabled={!subjectId}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 disabled:opacity-50"
            >
              <option value="">Any</option>
              {chaptersInSub.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <Field label="Year (any)">
            <select
              value={year}
              onChange={(e) => setYear(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">Any</option>
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>

          <Field label="Difficulty (any)">
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">Any</option>
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>

          <Field label="How many questions">
            <input
              type="number"
              value={count}
              min={1}
              max={100}
              onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
            />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Notes (style, focus, references)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. exam-style originals, focus on kinematics graphs, no past-paper text"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </Field>
        </div>

        {error && (
          <p className="mt-3 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <button
            disabled={!canSubmit || saving}
            onClick={handleCreate}
            className="rounded-xl border-b-4 border-lime-700 bg-lime-500 px-5 py-2 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Posting…" : "Post bounty"}
          </button>
        </div>
      </div>

      {/* List */}
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Existing bounties · {bounties.length}
        </h2>
        {bounties.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">No bounties yet.</p>
        ) : (
          <div className="space-y-2">
            {bounties.map((b) => (
              <div key={b.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${STATUS_BADGE[b.status] ?? ""}`}>
                        {b.status}
                      </span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {b.curriculum.code} · {b.subject.name}
                      </span>
                      {b.chapter && <span className="text-xs text-slate-500 dark:text-slate-400">· {b.chapter.name}</span>}
                      {b.year && <span className="text-xs text-slate-500 dark:text-slate-400">· {b.year}</span>}
                      {b.difficulty && <span className="text-xs text-slate-500 dark:text-slate-400">· {b.difficulty}</span>}
                    </div>
                    {b.notes && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{b.notes}</p>}
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold tabular-nums">{b.filledCount} / {b.count}</span> submitted
                      {b.claimedBy && (
                        <span className="ml-2">— claimed by {b.claimedBy.firstName} {b.claimedBy.lastName}</span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {b.status === "OPEN" || b.status === "CLAIMED" ? (
                      <button
                        onClick={() => changeStatus(b.id, "CLOSED")}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/20"
                      >
                        Close
                      </button>
                    ) : b.status === "CLOSED" ? (
                      <button
                        onClick={() => changeStatus(b.id, "OPEN")}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-lime-700 transition hover:bg-lime-50 dark:text-lime-400 dark:hover:bg-lime-950/20"
                      >
                        Reopen
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</label>
      {children}
    </div>
  )
}
