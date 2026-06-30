"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import type { DemoQuestion } from "@/lib/questions/demo-data"
import { ACCENTS, type Accent } from "@/lib/accents"
import { ContentBlockList, ContentBlockView } from "./content-block"
import { ThemePopover } from "./theme-popover"
import { CalcModal } from "./calc-modal"
import { impactLight, notifySuccess, notifyError } from "@/lib/native/haptics"

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"]

type Confidence = "high" | "medium" | "low"

type Props = {
  question: DemoQuestion
  currentIndex: number
  total: number
  nextHref: string
  wrongHref?: string
  onAnswered?: (isRight: boolean, confidence?: Confidence) => void
  accent?: Accent
}

export function QuestionCard({ question, currentIndex, total, nextHref, wrongHref, onAnswered, accent = "lime" }: Props) {
  const theme = ACCENTS[accent]
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>())
  const [submitted, setSubmitted] = useState(false)
  // Reveal grading only AFTER confidence is given/skipped (so it can't bias the rating).
  const [revealed, setRevealed] = useState(false)

  const multi = !!question.allowMultipleCorrect

  const correctIds = useMemo(
    () => new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id)),
    [question],
  )

  const optionsAreImage = question.options.every(
    (o) => o.content.kind === "image" || o.content.kind === "graph",
  )

  function pick(id: string) {
    if (submitted) return
    impactLight()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (multi) {
        if (next.has(id)) next.delete(id)
        else next.add(id)
      } else {
        next.clear()
        next.add(id)
      }
      return next
    })
  }

  function submit() {
    if (!selectedIds.size || submitted) return
    // Lock in the answer + ask confidence — no correctness cue yet.
    setSubmitted(true)
  }

  function pickConfidence(c: Confidence | undefined) {
    if (revealed) return
    setRevealed(true)
    const right =
      correctIds.size === selectedIds.size &&
      [...selectedIds].every((id) => correctIds.has(id))
    if (right) notifySuccess(); else notifyError()
    onAnswered?.(right, c)
  }

  const isRight =
    revealed &&
    correctIds.size === selectedIds.size &&
    [...selectedIds].every((id) => correctIds.has(id))

  const progressPct = Math.min(
    100,
    Math.round(((currentIndex + (submitted ? 1 : 0)) / total) * 100),
  )

  // Wrong picks and missed answers for the footer rationale block
  const wrongPicks = revealed
    ? question.options.filter((o) => selectedIds.has(o.id) && !o.isCorrect)
    : []
  const missedOptions = revealed && multi
    ? question.options.filter((o) => !selectedIds.has(o.id) && o.isCorrect)
    : []

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      {/* ── Sticky top bar ── */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur dark:bg-slate-950/90">
        {/* Icon row */}
        <div className="border-b border-slate-100 dark:border-slate-900">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-6 py-2.5 sm:px-10">
            <Link
              href="/"
              aria-label="Close practice"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-2xl leading-none font-light text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              ×
            </Link>

            <div className="flex flex-1 flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 min-w-0">
              <span className={cn("shrink-0 rounded-full px-2 py-0.5", theme.duoChip)}>
                {question.curriculum}
              </span>
              <span className="truncate">{question.subject}</span>
              <span aria-hidden className="text-slate-300 dark:text-slate-700">·</span>
              <span className="truncate">{question.chapter}</span>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <CalcModal accent={accent} />
              <ThemePopover
                questionIndex={currentIndex}
                currentStyle="duo"
                currentAccent={accent}
              />
            </div>
          </div>
        </div>

        {/* Progress bar — full width, flush */}
        <div
          className="h-1.5 w-full bg-slate-200 dark:bg-slate-800"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn("h-full transition-all duration-500 ease-out", theme.duoProgress)}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 pt-8 pb-44 sm:px-10">
        <ContentBlockList blocks={question.stem} variant="stem" />

        {multi && (
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Select all correct answers
          </p>
        )}

        <ul className={cn("grid gap-3", optionsAreImage ? "grid-cols-2" : "grid-cols-1")}>
          {question.options.map((opt, i) => {
            const isSelected = selectedIds.has(opt.id)
            // For multi-select: correct options the user didn't pick stay amber.
            const isMissed = revealed && multi && !isSelected && opt.isCorrect
            // Every correct option goes green on reveal (even if the user picked wrong).
            const isCorrectHighlight = revealed && opt.isCorrect && !isMissed
            const isWrongPick = revealed && isSelected && !opt.isCorrect

            return (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => pick(opt.id)}
                  disabled={submitted}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-2xl border-2 border-b-4 bg-white p-4 text-left transition active:translate-y-px active:border-b-2 dark:bg-slate-900",
                    "border-slate-200 dark:border-slate-800 dark:hover:bg-slate-800",
                    !submitted && theme.duoOptionHover,
                    isSelected && !submitted && theme.duoOptionSelected,
                    isCorrectHighlight && "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/30",
                    isWrongPick && "border-rose-500 bg-rose-50 dark:border-rose-400 dark:bg-rose-950/30",
                    isMissed && "border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/30",
                    submitted && "cursor-default active:translate-y-0 active:border-b-4",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center border-2 text-sm font-extrabold transition",
                      multi ? "rounded-lg" : "rounded-xl",
                      "border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400",
                      isSelected && !submitted && theme.duoLabelSelected,
                      isCorrectHighlight && "border-emerald-500 bg-emerald-500 text-white",
                      isWrongPick && "border-rose-500 bg-rose-500 text-white",
                      isMissed && "border-amber-400 bg-amber-400 text-white",
                    )}
                  >
                    {OPTION_LABELS[i]}
                  </span>
                  <div className="flex-1">
                    <ContentBlockView block={opt.content} variant="option" />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </main>

      {/* ── Sticky footer ── */}
      <footer
        className={cn(
          "sticky bottom-0 z-20 border-t-2 transition-colors",
          !revealed && "border-slate-100 bg-white dark:border-slate-900 dark:bg-slate-950",
          revealed && isRight && "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40",
          revealed && !isRight && "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40",
        )}
      >
        <div className="mx-auto w-full max-w-2xl px-6 py-4 sm:px-10">
          {!submitted ? (
            <div className="flex flex-col gap-3">
              {!selectedIds.size && (
                <p className="text-center text-xs font-medium text-slate-400 dark:text-slate-500">
                  {multi ? "Select all correct answers" : "Select an answer to continue"}
                </p>
              )}
              {multi && selectedIds.size > 0 && (
                <p className="text-center text-xs font-medium text-slate-400 dark:text-slate-500">
                  {selectedIds.size} selected — tap more or check
                </p>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={!selectedIds.size}
                className={cn(
                  "w-full rounded-2xl border-b-4 py-4 text-base font-black uppercase tracking-widest transition active:translate-y-px active:border-b-2",
                  selectedIds.size
                    ? cn(theme.duoCtaBorder, theme.duoCtaFill)
                    : "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600",
                )}
              >
                Check
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Confidence tap — shown after submit, before the answer is revealed */}
              {!revealed ? (
                <div>
                  <p className="mb-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                    How confident were you?
                  </p>
                  <div className="flex gap-2">
                    {([
                      { key: "high",   label: "🟢 High"   },
                      { key: "medium", label: "🟡 Medium" },
                      { key: "low",    label: "🔴 Low"    },
                    ] as { key: Confidence; label: string }[]).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => pickConfidence(key)}
                        className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      onClick={() => pickConfidence(undefined)}
                      className="rounded-xl border border-slate-100 px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <h2
                    className={cn(
                      "text-xl font-extrabold sm:text-2xl",
                      isRight ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300",
                    )}
                  >
                    {isRight ? "Nailed it!" : "Not quite."}
                  </h2>
                  <Link
                    href={isRight ? nextHref : (wrongHref ?? nextHref)}
                    className={cn(
                      "rounded-2xl border-b-4 px-8 py-3 text-sm font-extrabold uppercase tracking-widest text-white transition active:translate-y-px active:border-b-2",
                      isRight
                        ? "border-emerald-700 bg-emerald-500 hover:bg-emerald-400"
                        : "border-rose-700 bg-rose-500 hover:bg-rose-400",
                    )}
                  >
                    Continue →
                  </Link>
                </div>
              )}

              {revealed && wrongPicks.map((o) => o.rationale && (
                <p key={o.id} className="text-sm italic text-rose-900 dark:text-rose-200">
                  {o.rationale}
                </p>
              ))}
              {revealed && missedOptions.length > 0 && (
                <p className="text-sm italic text-amber-800 dark:text-amber-300">
                  You missed: {missedOptions.map((o, i) => (
                    <span key={o.id}>{i > 0 ? " and " : ""}{OPTION_LABELS[question.options.indexOf(o)]}</span>
                  ))}
                </p>
              )}

              {revealed && <ContentBlockList blocks={question.explanation} variant="explanation" />}
            </div>
          )}
        </div>
      </footer>
    </div>
  )
}
