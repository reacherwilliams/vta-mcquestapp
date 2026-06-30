"use client"

import Link from "next/link"
import { useMemo, useState, type ReactNode } from "react"
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
  // QA/test mode: skip the confidence tap and reveal the answer immediately on submit.
  hideConfidence?: boolean
  // Replaces the post-reveal Exit/Continue row (used by the admin QA queue for Pass/Send-back).
  revealFooter?: ReactNode
  // When set, the pre-reveal "Exit" calls this instead of navigating to the landing page.
  onExit?: () => void
}

export function SwissQuestionCard({ question, currentIndex, total, nextHref, wrongHref, onAnswered, accent = "lime", hideConfidence, revealFooter, onExit }: Props) {
  const theme = ACCENTS[accent]
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>())
  const [submitted, setSubmitted] = useState(false)
  // The answer is only graded/revealed AFTER confidence is given or skipped —
  // so the red/green reveal can't bias the confidence rating.
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

  function reveal(c: Confidence | undefined) {
    if (revealed) return
    setRevealed(true)
    const right =
      correctIds.size === selectedIds.size &&
      [...selectedIds].every((id) => correctIds.has(id))
    if (right) notifySuccess(); else notifyError()
    onAnswered?.(right, c)
  }

  function submit() {
    if (!selectedIds.size || submitted) return
    setSubmitted(true)
    // In QA/test mode there's no confidence step — reveal straight away.
    if (hideConfidence) reveal(undefined)
  }

  function pickConfidence(c: Confidence | undefined) {
    reveal(c)
  }

  const isRight =
    revealed &&
    correctIds.size === selectedIds.size &&
    [...selectedIds].every((id) => correctIds.has(id))

  const wrongPicks = revealed
    ? question.options.filter((o) => selectedIds.has(o.id) && !o.isCorrect)
    : []
  const missedOptions = revealed && multi
    ? question.options.filter((o) => !selectedIds.has(o.id) && o.isCorrect)
    : []

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 sm:px-10">

        {/* ── Top bar ── */}
        <header className="flex items-center gap-3 border-b border-slate-200 py-4 dark:border-slate-800">
          <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 min-w-0">
            <span>{question.curriculum}</span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span>{question.subject}</span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="normal-case tracking-normal text-slate-600 dark:text-slate-400 truncate">
              {question.chapter}
            </span>
          </div>
          <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Q {String(currentIndex + 1).padStart(2, "0")}&nbsp;/&nbsp;{String(total).padStart(2, "0")}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <CalcModal accent={accent} />
            <ThemePopover
              questionIndex={currentIndex}
              currentStyle="swiss"
              currentAccent={accent}
            />
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="py-10 pb-44 sm:py-14 sm:pb-48">
          <ContentBlockList blocks={question.stem} variant="stem" />

          {multi && (
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Select all correct answers
            </p>
          )}

          <ul
            className={cn(
              "mt-6 grid",
              optionsAreImage ? "grid-cols-2 gap-4 sm:gap-5" : "grid-cols-1",
            )}
          >
            {question.options.map((opt, i) => {
              const isSelected = selectedIds.has(opt.id)
              // Multi-select correct answers the user didn't pick stay amber ("you missed this").
              const isMissed = revealed && multi && !isSelected && opt.isCorrect
              // Every correct option is highlighted green on reveal (even if the user picked wrong),
              // except multi-select misses which use amber to flag they were left out.
              const isCorrectHighlight = revealed && opt.isCorrect && !isMissed
              const isWrongPick = revealed && isSelected && !opt.isCorrect

              const railClass = isCorrectHighlight
                ? "border-l-4 border-emerald-500"
                : isWrongPick
                  ? "border-l-4 border-rose-500"
                  : isMissed
                    ? "border-l-4 border-amber-400"
                    : isSelected
                      ? cn("border-l-4", theme.swissActiveRule.split(" ").filter(c => c.startsWith("border-")).join(" "))
                      : "border-l-[3px] border-transparent"

              const textClass = isCorrectHighlight
                ? "text-emerald-700 dark:text-emerald-300"
                : isWrongPick
                  ? "text-rose-700 dark:text-rose-300"
                  : isMissed
                    ? "text-amber-700 dark:text-amber-300"
                    : isSelected
                      ? theme.swissActiveLabel
                      : "text-slate-400 dark:text-slate-600"

              return (
                <li key={opt.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => pick(opt.id)}
                    disabled={submitted}
                    aria-pressed={isSelected}
                    className={cn(
                      "group flex w-full items-baseline gap-4 py-4 pr-2 pl-5 text-left transition",
                      railClass,
                      (isSelected || isCorrectHighlight || isWrongPick || isMissed) && "border-b-2",
                      !submitted && !isSelected && "hover:border-l-4 hover:border-b-2 hover:border-slate-300 hover:text-slate-700 dark:hover:border-slate-600",
                      submitted && "cursor-default",
                    )}
                  >
                    <span className={cn("w-4 shrink-0 font-mono text-sm font-semibold", textClass)}>
                      {OPTION_LABELS[i]}.
                    </span>
                    <span className="flex-1 text-slate-900 dark:text-slate-100">
                      <ContentBlockView block={opt.content} variant="option" />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </main>
      </div>

      {/* ── Sticky footer — outside centered wrapper ── */}
      <footer
        className={cn(
          "sticky bottom-0 z-20 border-t-2 transition-colors",
          !revealed && "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
          revealed && isRight && "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40",
          revealed && !isRight && "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40",
        )}
      >
        <div className="mx-auto w-full max-w-2xl px-6 py-5 sm:px-10">
          {!submitted ? (
            <div className="flex flex-col gap-3">
              {!selectedIds.size && (
                <p className="text-center text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  {multi ? "Select all correct answers" : "Select an answer"}
                </p>
              )}
              {multi && selectedIds.size > 0 && (
                <p className="text-center text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  {selectedIds.size} selected — tap more or check
                </p>
              )}
              <div className="flex items-center justify-between gap-4">
                {onExit ? (
                  <button
                    type="button"
                    onClick={onExit}
                    className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    ← Exit
                  </button>
                ) : (
                  <Link
                    href="/"
                    className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    ← Exit
                  </Link>
                )}
                <button
                  type="button"
                  onClick={submit}
                  disabled={!selectedIds.size}
                  className={cn(
                    "border-b-2 pb-0.5 text-sm font-semibold uppercase tracking-[0.18em] transition",
                    selectedIds.size
                      ? cn(theme.swissActiveLink, "border-current")
                      : "cursor-not-allowed border-transparent text-slate-300 dark:text-slate-700",
                  )}
                >
                  Check →
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Confidence tap — shown after submit, before the answer is revealed */}
              {!revealed ? (
                <div>
                  <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
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
                <>
                  <div
                    className={cn(
                      "border-l-4 pl-5",
                      isRight ? "border-emerald-500" : "border-rose-500",
                    )}
                  >
                    <p
                      className={cn(
                        "mb-2 text-[11px] font-semibold uppercase tracking-[0.18em]",
                        isRight ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300",
                      )}
                    >
                      {isRight ? "Correct" : "Incorrect"}
                    </p>
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      <ContentBlockList blocks={question.explanation} variant="explanation" />
                      {wrongPicks.map((o) => o.rationale && (
                        <p key={o.id} className="mt-2 italic text-slate-500">{o.rationale}</p>
                      ))}
                      {missedOptions.length > 0 && (
                        <p className="mt-2 italic text-amber-700 dark:text-amber-400">
                          You missed: {missedOptions.map((o, idx) => (
                            <span key={o.id}>{idx > 0 ? " and " : ""}<strong>{OPTION_LABELS[question.options.indexOf(o)]}</strong></span>
                          ))}
                        </p>
                      )}
                    </div>
                  </div>
                  {revealFooter ?? (
                    <div className="flex items-center justify-between">
                      <Link href="/" className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">← Exit</Link>
                      <Link
                        href={isRight ? nextHref : (wrongHref ?? nextHref)}
                        className={cn(
                          "border-b-2 border-current pb-0.5 text-sm font-semibold uppercase tracking-[0.18em] transition",
                          isRight
                            ? "text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
                            : "text-rose-700 hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-100",
                        )}
                      >
                        Continue →
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </footer>
    </div>
  )
}
