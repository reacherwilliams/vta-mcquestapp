"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { demoQuestions } from "@/lib/questions/demo-data"
import { ACCENTS } from "@/lib/accents"
import { cn } from "@/lib/utils"
import type { Accent } from "@/lib/accents"

// ── Demo-mode filter options (guest flow) ────────────────────────────────────

const DEMO_CURRICULA = [...new Set(demoQuestions.map((q) => q.curriculum))].sort()

const DEMO_SUBJECTS_BY_CURRICULUM: Record<string, string[]> = {}
for (const q of demoQuestions) {
  if (!DEMO_SUBJECTS_BY_CURRICULUM[q.curriculum]) DEMO_SUBJECTS_BY_CURRICULUM[q.curriculum] = []
  if (!DEMO_SUBJECTS_BY_CURRICULUM[q.curriculum].includes(q.subject)) {
    DEMO_SUBJECTS_BY_CURRICULUM[q.curriculum].push(q.subject)
  }
}

const DEMO_ALL_YEARS = [...new Set(demoQuestions.flatMap((q) => q.tags))].sort()

// ── Types ─────────────────────────────────────────────────────────────────────

export type DbSubject = {
  id: string
  curriculumCode: string
  curriculumName: string
  name: string
  hasFrq?: boolean
  chapters: { id: string; name: string; ibLevel?: string | null }[]
}

// ── Chip ──────────────────────────────────────────────────────────────────────

function Chip({
  label,
  active,
  onClick,
  chipClass,
}: {
  label: string
  active: boolean
  onClick: () => void
  chipClass: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
        active
          ? cn(chipClass, "border-transparent")
          : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500",
      )}
    >
      {label}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function FilterClient({
  accent,
  style,
  isAuthenticated,
  dbSubjects,
}: {
  accent: Accent
  style: "duo" | "swiss"
  isAuthenticated: boolean
  dbSubjects: DbSubject[]
}) {
  const router = useRouter()
  const theme = ACCENTS[accent]

  // Shared state
  const [curriculum, setCurriculum] = useState<string | null>(null)
  const [subject, setSubject] = useState<string | null>(null)
  const [subjectId, setSubjectId] = useState<string | null>(null)
  const [chapter, setChapter] = useState<string | null>(null)
  const [chapterId, setChapterId] = useState<string | null>(null)
  const [years, setYears] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── DB mode helpers ─────────────────────────────────────────────────────
  const useDbMode = isAuthenticated && dbSubjects.length > 0

  const dbCurricula = useDbMode
    ? [...new Map(dbSubjects.map((s) => [s.curriculumCode, s.curriculumName])).entries()]
        .map(([code, name]) => ({ code, name }))
    : []

  // Cascading: subjects are scoped to a single curriculum. When only one
  // curriculum is available (the future "enrolled student" case), it's the
  // implicit selection so the student never has to pick. Otherwise the student
  // must choose a curriculum before any subjects appear — no more duplicate
  // "Mathematics × 5" across curricula.
  const availableCurriculumCodes = useDbMode ? dbCurricula.map((c) => c.code) : DEMO_CURRICULA
  const soleCurriculum = availableCurriculumCodes.length === 1 ? availableCurriculumCodes[0] : null
  const activeCurriculum = curriculum ?? soleCurriculum

  const dbFilteredSubjects = useDbMode && activeCurriculum
    ? dbSubjects.filter((s) => s.curriculumCode === activeCurriculum)
    : []

  const dbChapters = useDbMode && subjectId
    ? (dbSubjects.find((s) => s.id === subjectId)?.chapters ?? [])
    : []

  // ── Demo mode helpers ───────────────────────────────────────────────────
  const demoSubjects = activeCurriculum
    ? (DEMO_SUBJECTS_BY_CURRICULUM[activeCurriculum] ?? [])
    : []

  function toggleYear(y: string) {
    setYears((prev) => (prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y]))
  }

  function resetSubject() {
    setSubject(null)
    setSubjectId(null)
    setChapter(null)
    setChapterId(null)
  }

  // ── Start practice ──────────────────────────────────────────────────────

  async function startPractice() {
    setError(null)

    if (useDbMode) {
      // Authenticated + DB subjects available — create a DB session
      setLoading(true)
      try {
        const filter: Record<string, unknown> = {}
        if (subjectId) filter.subjectId = subjectId
        if (chapterId) filter.chapterId = chapterId

        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "PRACTICE", filter, limit: 20 }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? "Could not start session.")
          setLoading(false)
          return
        }
        router.push(
          `/practice/session/${data.id}?q=0&wrong=&style=${style}&accent=${accent}`,
        )
      } catch {
        setError("Network error. Please try again.")
        setLoading(false)
      }
      return
    }

    // Guest / demo flow — URL-state session using demo question indices
    const matching = demoQuestions
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => {
        if (curriculum && q.curriculum !== curriculum) return false
        if (subject && q.subject !== subject) return false
        if (years.length > 0 && !years.some((y) => q.tags.includes(y))) return false
        return true
      })
      .map(({ i }) => i)

    const qids = (matching.length > 0 ? matching : demoQuestions.map((_, i) => i)).join(",")
    const run = Date.now().toString(36)
    router.push(
      `/practice/session?qids=${qids}&q=0&wrong=&pass=0&run=${run}&style=${style}&accent=${accent}`,
    )
  }

  return (
    <div className="space-y-8">
      {/* Curriculum */}
      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Curriculum
        </p>
        <div className="flex flex-wrap gap-2">
          {useDbMode
            ? dbCurricula.map(({ code, name }) => (
                <Chip
                  key={code}
                  label={name}
                  active={activeCurriculum === code}
                  chipClass={theme.duoChip}
                  onClick={() => {
                    setCurriculum((prev) => (prev === code ? null : code))
                    resetSubject()
                  }}
                />
              ))
            : DEMO_CURRICULA.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={activeCurriculum === c}
                  chipClass={theme.duoChip}
                  onClick={() => {
                    setCurriculum((prev) => (prev === c ? null : c))
                    resetSubject()
                  }}
                />
              ))}
        </div>
      </section>

      {/* Subject */}
      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Subject
        </p>
        {!activeCurriculum ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Pick a curriculum above to see its subjects.
          </p>
        ) : (
        <div className="flex flex-wrap gap-2">
          {useDbMode
            ? dbFilteredSubjects.map((s) => (
                <Chip
                  key={s.id}
                  label={s.name}
                  active={subjectId === s.id}
                  chipClass={theme.duoChip}
                  onClick={() => {
                    if (subjectId === s.id) {
                      setSubjectId(null)
                      setSubject(null)
                    } else {
                      setSubjectId(s.id)
                      setSubject(s.name)
                    }
                    setChapter(null)
                    setChapterId(null)
                  }}
                />
              ))
            : demoSubjects.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  active={subject === s}
                  chipClass={theme.duoChip}
                  onClick={() => setSubject((prev) => (prev === s ? null : s))}
                />
              ))}
        </div>
        )}
      </section>

      {/* Chapter — only in DB mode when a subject is selected */}
      {useDbMode && dbChapters.length > 0 && (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Chapter
          </p>
          <div className="flex flex-wrap gap-2">
            {dbChapters.map((ch) => {
              const ibLabel = ch.ibLevel === "HL" ? "HL" : ch.ibLevel === "SL" ? "SL" : null
              return (
                <button
                  key={ch.id}
                  onClick={() => {
                    if (chapterId === ch.id) { setChapterId(null); setChapter(null) }
                    else { setChapterId(ch.id); setChapter(ch.name) }
                  }}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    chapterId === ch.id ? theme.duoChip + " border-transparent" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {ch.name}
                  {ibLabel && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                      ibLabel === "HL"
                        ? "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
                        : "bg-sky-200 text-sky-800 dark:bg-sky-900 dark:text-sky-300"
                    }`}>
                      {ibLabel}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* AP FRQ disclaimer */}
      {useDbMode && subjectId && dbSubjects.find((s) => s.id === subjectId)?.hasFrq && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/20">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <strong>AP note:</strong> MCQ MasterLoop covers MCQ sections only. This subject also has Free Response Questions (FRQ) in the real exam — practice those separately using College Board materials.
          </p>
        </div>
      )}

      {/* Year — demo mode only (DB uses tags filter) */}
      {!useDbMode && DEMO_ALL_YEARS.length > 0 && (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Year
          </p>
          <div className="flex flex-wrap gap-2">
            {DEMO_ALL_YEARS.map((y) => (
              <Chip
                key={y}
                label={y}
                active={years.includes(y)}
                chipClass={theme.duoChip}
                onClick={() => toggleYear(y)}
              />
            ))}
          </div>
        </section>
      )}

      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={startPractice}
        disabled={loading}
        className={cn(
          "w-full rounded-2xl border-b-4 py-4 text-base font-black uppercase tracking-widest transition active:translate-y-px active:border-b-2 disabled:opacity-60",
          theme.duoCtaBorder,
          theme.duoCtaFill,
        )}
      >
        {loading ? "Starting…" : "Start Practice →"}
      </button>
    </div>
  )
}
