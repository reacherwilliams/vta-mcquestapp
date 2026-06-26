"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

type Item = {
  id: string
  stem: unknown
  difficulty: string
  status: string
  year: number | null
  aiAssisted: boolean
  createdAt: Date
  subject: {
    name: string
    code: string
    curriculum: { code: string; displayName: string }
  }
  chapter: { name: string }
  author: { firstName: string | null; lastName: string | null } | null
}

const CURRICULUM_BADGE: Record<string, string> = {
  IGCSE:    "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  AS_LEVEL: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
  A2_LEVEL: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  IB_DP:    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  AP:       "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT:                "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  IN_SUBJECT_REVIEW:    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  IN_CURRICULUM_REVIEW: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  PUBLISHED:            "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  ARCHIVED:             "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT:                "Draft",
  IN_SUBJECT_REVIEW:    "Subject Review",
  IN_CURRICULUM_REVIEW: "Curriculum Review",
  PUBLISHED:            "Published",
  ARCHIVED:             "Archived",
}

const DIFFICULTY_BADGE: Record<string, string> = {
  EASY:      "bg-lime-50 text-lime-700 dark:bg-lime-950/30 dark:text-lime-400",
  MEDIUM:    "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400",
  HARD:      "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  CHALLENGE: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
}

// Quick actions in the table — full nuance (notes, reassign) lives in /review.
const STATUS_ACTIONS: Record<string, { label: string; action: string }[]> = {
  DRAFT:                [{ label: "Submit",  action: "submit"  }],
  IN_SUBJECT_REVIEW:    [{ label: "Approve", action: "approve" }],
  IN_CURRICULUM_REVIEW: [{ label: "Approve", action: "approve" }],
  PUBLISHED:            [{ label: "Archive", action: "archive" }],
  ARCHIVED:             [{ label: "Restore", action: "restore" }],
}

function stemPreview(stem: unknown): string {
  if (!Array.isArray(stem)) return "—"
  for (const block of stem) {
    if ((block?.kind === "text" || block?.type === "text") && block?.text) {
      return block.text as string
    }
  }
  return "—"
}

export function QuestionsTable({
  items, page, pages,
}: {
  items: Item[]
  page: number
  pages: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [changing, setChanging] = useState<string | null>(null)

  async function runAction(id: string, action: string) {
    setChanging(id)
    await fetch(`/api/admin/questions/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    setChanging(null)
    router.refresh()
  }

  function buildHref(newPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(newPage))
    return `/admin/questions?${params.toString()}`
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-400 dark:border-slate-700">
          No questions found
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-800 dark:bg-slate-900/60">
                <th className="px-3 py-3 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">Curriculum</th>
                <th className="px-3 py-3 font-semibold text-slate-600 dark:text-slate-400">Subject</th>
                <th className="px-3 py-3 font-semibold text-slate-600 dark:text-slate-400">Chapter</th>
                <th className="px-3 py-3 font-semibold text-slate-600 dark:text-slate-400">Question</th>
                <th className="px-3 py-3 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">Year</th>
                <th className="px-3 py-3 font-semibold text-slate-600 dark:text-slate-400">Difficulty</th>
                <th className="px-3 py-3 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                <th className="px-3 py-3 font-semibold text-slate-600 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {items.map((q) => {
                const preview = stemPreview(q.stem)
                const actions = STATUS_ACTIONS[q.status] ?? []
                const currBadge = CURRICULUM_BADGE[q.subject.curriculum.code] ?? "bg-slate-100 text-slate-600"
                return (
                  <tr key={q.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    {/* Curriculum */}
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${currBadge}`}>
                        {q.subject.curriculum.code.replace("_", " ")}
                      </span>
                    </td>

                    {/* Subject */}
                    <td className="px-3 py-3 max-w-30">
                      <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {q.subject.name}
                      </p>
                      <p className="text-[10px] text-slate-400">{q.subject.code}</p>
                    </td>

                    {/* Chapter */}
                    <td className="px-3 py-3 max-w-35">
                      <p className="truncate text-xs text-slate-600 dark:text-slate-400">{q.chapter.name}</p>
                    </td>

                    {/* Question stem */}
                    <td className="px-3 py-3 max-w-65">
                      <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">{preview}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {new Date(q.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        {q.aiAssisted && " · AI"}
                        {q.author && ` · ${[q.author.firstName, q.author.lastName].filter(Boolean).join(" ")}`}
                      </p>
                    </td>

                    {/* Year */}
                    <td className="px-3 py-3">
                      {q.year ? (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {q.year}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>

                    {/* Difficulty */}
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${DIFFICULTY_BADGE[q.difficulty] ?? ""}`}>
                        {q.difficulty === "CHALLENGE" ? "Chal." : q.difficulty.charAt(0) + q.difficulty.slice(1).toLowerCase()}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${STATUS_BADGE[q.status] ?? ""}`}>
                        {STATUS_LABEL[q.status] ?? q.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/admin/questions/${q.id}/edit`}
                          className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 whitespace-nowrap"
                        >
                          Edit
                        </Link>
                        {actions.map(({ label, action }) => (
                          <button
                            key={action}
                            disabled={changing === q.id}
                            onClick={() => runAction(q.id, action)}
                            className={[
                              "rounded-lg px-2 py-1 text-xs font-semibold transition whitespace-nowrap",
                              action === "approve"
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : action === "archive"
                                ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/20"
                                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
                              changing === q.id ? "opacity-50 cursor-not-allowed" : "",
                            ].join(" ")}
                          >
                            {changing === q.id ? "…" : label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">Page {page} of {pages}</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildHref(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                ← Prev
              </Link>
            )}
            {page < pages && (
              <Link href={buildHref(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
