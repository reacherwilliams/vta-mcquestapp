"use client"

import { ContentBlockView } from "@/components/questions/content-block"
import type { ContentBlock } from "@/lib/questions/types"
import { cn } from "@/lib/utils"

type OptionDraft = {
  content: ContentBlock
  isCorrect: boolean
  rationale: string
  sortOrder: number
}

type Props = {
  stem: ContentBlock[]
  options: OptionDraft[]
  explanation: ContentBlock[]
  allowMultipleCorrect: boolean
  difficulty: string
}

const LABELS = ["A", "B", "C", "D", "E", "F"]

const DIFFICULTY_COLOUR: Record<string, string> = {
  EASY:      "text-lime-600 bg-lime-50 dark:text-lime-400 dark:bg-lime-950/30",
  MEDIUM:    "text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-950/30",
  HARD:      "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950/30",
  CHALLENGE: "text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/30",
}

export function QuestionPreview({ stem, options, explanation, allowMultipleCorrect, difficulty }: Props) {
  const hasContent = stem.some(
    (b) => (b.kind === "text" && b.text.trim()) || (b.kind === "math" && b.latex.trim()) || b.kind === "image" || b.kind === "graph"
  )

  if (!hasContent) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 text-sm text-slate-400 dark:border-slate-700">
        Start writing a stem to see the preview
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">Student view</span>
        <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", DIFFICULTY_COLOUR[difficulty])}>
          {difficulty}
        </span>
      </div>

      {/* Question card (Duo style) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* Stem */}
        <div className="mb-6 space-y-3">
          {stem.map((block, i) => (
            <ContentBlockView key={i} block={block} variant="stem" />
          ))}
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {options.map((opt, i) => {
            const label = LABELS[i] ?? String(i + 1)
            const isEmpty = opt.content.kind === "text" && !opt.content.text.trim()
            if (isEmpty) return null
            return (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-4 py-3",
                  opt.isCorrect
                    ? "border-lime-300 bg-lime-50 dark:border-lime-700 dark:bg-lime-950/20"
                    : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black",
                    opt.isCorrect
                      ? "bg-lime-500 text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  )}
                >
                  {label}
                </span>
                <div className="flex-1">
                  <ContentBlockView block={opt.content} variant="option" />
                  {opt.isCorrect && (
                    <p className="mt-1 text-[10px] font-semibold text-lime-600 dark:text-lime-400">✓ Correct answer</p>
                  )}
                  {opt.rationale && !opt.isCorrect && (
                    <p className="mt-1 text-[10px] text-slate-400 italic">{opt.rationale}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Explanation */}
      {explanation.length > 0 && explanation.some(
        (b) => (b.kind === "text" && b.text.trim()) || (b.kind === "math" && b.latex.trim())
      ) && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Explanation</p>
          <div className="space-y-2">
            {explanation.map((block, i) => (
              <ContentBlockView key={i} block={block} variant="explanation" />
            ))}
          </div>
        </div>
      )}

      {allowMultipleCorrect && (
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          Multi-select question — students must select all correct options
        </p>
      )}
    </div>
  )
}
