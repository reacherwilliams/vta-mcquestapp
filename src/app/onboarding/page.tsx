"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"

// ── Step data ──────────────────────────────────────────────────────────────

const CURRICULA = [
  { id: "IGCSE", label: "IGCSE", note: "Cambridge International — Grades 10–11" },
  { id: "AS_LEVEL", label: "AS Level", note: "Cambridge International — Year 12" },
  { id: "A2_LEVEL", label: "A2 Level", note: "Cambridge International — Year 13" },
  { id: "IB_DP", label: "IB Diploma", note: "International Baccalaureate — DP" },
  { id: "AP", label: "AP", note: "Advanced Placement — College Board" },
]

const SUBJECTS = [
  { id: "MATH", label: "Mathematics", icon: "∑", accent: "lime" },
  { id: "PHY", label: "Physics", icon: "⚡", accent: "sky" },
  { id: "CHEM", label: "Chemistry", icon: "⬡", accent: "teal" },
  { id: "BIO", label: "Biology", icon: "🌿", accent: "orange" },
  { id: "BUS", label: "Business Studies", icon: "📈", accent: "amber" },
  { id: "CS", label: "Computer Science", icon: "</>" , accent: "pink" },
  { id: "ECO", label: "Economics", icon: "§", accent: "lime" },
  { id: "GEO", label: "Geography", icon: "◯", accent: "teal" },
  { id: "ENG", label: "English Language", icon: "A", accent: "orange" },
  { id: "HIS", label: "History", icon: "⏳", accent: "amber" },
]

const GOALS = [
  { id: 10, label: "Easy", xp: "10 XP / day", description: "Light practice. A few questions a day." },
  { id: 20, label: "Normal", xp: "20 XP / day", description: "Steady progress. The sweet spot." },
  { id: 30, label: "Intense", xp: "30 XP / day", description: "Push hard. For the dedicated few." },
]

const TOTAL_STEPS = 3

// ── Shared chip button ────────────────────────────────────────────────────────

function Chip({
  label,
  note,
  icon,
  active,
  onClick,
}: {
  label: string
  note?: string
  icon?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition",
        active
          ? "border-lime-500 bg-lime-50 dark:border-lime-400 dark:bg-lime-950/30"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600",
      )}
    >
      {icon && (
        <span className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg font-bold",
          active ? "bg-lime-500 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
        )}>
          {icon}
        </span>
      )}
      {!icon && (
        <span className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition",
          active
            ? "border-lime-500 bg-lime-500"
            : "border-slate-300 dark:border-slate-600",
        )}>
          {active && (
            <svg viewBox="0 0 10 10" className="h-3 w-3 text-white" fill="currentColor">
              <path d="M8.5 2.5 4 7 1.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          )}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-semibold",
          active ? "text-lime-800 dark:text-lime-200" : "text-slate-800 dark:text-slate-200",
        )}>
          {label}
        </p>
        {note && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{note}</p>
        )}
      </div>
    </button>
  )
}

// ── Steps ─────────────────────────────────────────────────────────────────────

function StepCurriculum({
  selected,
  onToggle,
}: {
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
          Which curriculum are you studying?
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Select all that apply.</p>
      </div>
      <div className="space-y-2.5">
        {CURRICULA.map((c) => (
          <Chip
            key={c.id}
            label={c.label}
            note={c.note}
            active={selected.includes(c.id)}
            onClick={() => onToggle(c.id)}
          />
        ))}
      </div>
    </div>
  )
}

function StepSubjects({
  selected,
  onToggle,
}: {
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
          Choose your subjects
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Pick everything you study — you can change this later.
        </p>
      </div>
      <div className="space-y-2">
        {SUBJECTS.map((s) => (
          <Chip
            key={s.id}
            label={s.label}
            icon={s.icon}
            active={selected.includes(s.id)}
            onClick={() => onToggle(s.id)}
          />
        ))}
      </div>
    </div>
  )
}

function StepGoal({
  selected,
  onSelect,
}: {
  selected: number | null
  onSelect: (id: number) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
          Set your daily goal
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          You earn XP for every question you answer. How much do you want to earn each day?
        </p>
      </div>
      <div className="space-y-3">
        {GOALS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelect(g.id)}
            className={cn(
              "flex w-full flex-col rounded-2xl border-2 border-b-4 px-5 py-4 text-left transition active:translate-y-px active:border-b-2",
              selected === g.id
                ? "border-lime-500 bg-lime-50 dark:border-lime-400 dark:bg-lime-950/30"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600",
            )}
          >
            <div className="flex items-center justify-between">
              <span className={cn(
                "text-base font-extrabold",
                selected === g.id ? "text-lime-800 dark:text-lime-200" : "text-slate-900 dark:text-slate-100",
              )}>
                {g.label}
              </span>
              <span className={cn(
                "text-sm font-bold",
                selected === g.id ? "text-lime-600 dark:text-lime-400" : "text-slate-500 dark:text-slate-400",
              )}>
                {g.xp}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{g.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Onboarding shell ──────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [curricula, setCurricula] = useState<string[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [goal, setGoal] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  function toggleCurriculum(id: string) {
    setCurricula((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }
  function toggleSubject(id: string) {
    setSubjects((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const canContinue =
    step === 1 ? curricula.length > 0 :
    step === 2 ? subjects.length > 0 :
    goal !== null

  async function handleContinue() {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1)
      return
    }
    setSaving(true)
    try {
      await fetch("/api/me/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curriculumCodes: curricula,
          subjectCodes: subjects,
          dailyXpGoal: goal ?? 20,
        }),
      })
    } catch {
      // Non-fatal — preferences can be updated later in profile
    }
    router.push("/practice")
  }

  const progressPct = Math.round((step / TOTAL_STEPS) * 100)

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      {/* Progress bar */}
      <div className="h-1 bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full bg-linear-to-r from-orange-500 via-amber-500 to-lime-500 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 sm:px-10">
        <span className="text-xl font-black text-slate-900 dark:text-slate-100">
          MCQ<span className="text-lime-600"> MasterLoop</span>
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          {step} / {TOTAL_STEPS}
        </span>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-sm flex-1 px-6 pb-36 pt-4 sm:px-10">
        {step === 1 && (
          <StepCurriculum selected={curricula} onToggle={toggleCurriculum} />
        )}
        {step === 2 && (
          <StepSubjects selected={subjects} onToggle={toggleSubject} />
        )}
        {step === 3 && (
          <StepGoal selected={goal} onSelect={setGoal} />
        )}
      </main>

      {/* Sticky footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-900 dark:bg-slate-950/95 sm:px-10">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-2">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue || saving}
            className={cn(
              "w-full rounded-2xl border-b-4 py-4 text-base font-black uppercase tracking-widest transition active:translate-y-px active:border-b-2",
              canContinue && !saving
                ? "border-lime-700 bg-lime-500 text-slate-900 hover:bg-lime-400"
                : "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600",
            )}
          >
            {saving ? "Saving…" : step === TOTAL_STEPS ? "Let's go →" : "Continue →"}
          </button>
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="text-center text-sm font-medium text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
            >
              ← Back
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
