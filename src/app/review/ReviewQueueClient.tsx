"use client"

import { useState, type ReactElement } from "react"
import { useRouter } from "next/navigation"
import { ContentBlockList, ContentBlockView } from "@/components/questions/content-block"
import type { ContentBlock } from "@/lib/questions/types"

type ReviewerStub = { id: string; firstName: string; lastName: string }

type QueueItem = {
  id: string
  status: string  // QuestionStatus — narrowed to IN_SUBJECT_REVIEW | IN_CURRICULUM_REVIEW at fetch time
  difficulty: string
  year: number | null
  tags: unknown
  stem: unknown
  explanation: unknown
  allowMultipleCorrect: boolean
  authorId: string | null
  lastReviewNote: string | null
  subject: { id: string; name: string; code: string; curriculum: { id: string; code: string; displayName: string } }
  chapter: { name: string }
  unit: { name: string } | null
  author: { firstName: string; lastName: string; email: string } | null
  options: { id: string; content: unknown; isCorrect: boolean; sortOrder: number }[]
}

type Props = {
  currentUserId: string
  queue: QueueItem[]
  subjectReviewers:    Record<string, ReviewerStub[]>
  curriculumReviewers: Record<string, ReviewerStub[]>
}

const TIER_LABEL: Record<string, string> = {
  IN_SUBJECT_REVIEW: "Subject tier",
  IN_CURRICULUM_REVIEW: "Curriculum tier",
}

export function ReviewQueueClient({ currentUserId, queue, subjectReviewers, curriculumReviewers }: Props) {
  if (queue.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-400 dark:border-slate-700">
        Your queue is empty.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {queue.map((q) => (
        <ReviewRow
          key={q.id}
          q={q}
          currentUserId={currentUserId}
          peers={
            q.status === "IN_SUBJECT_REVIEW"
              ? (subjectReviewers[q.subject.id] ?? [])
              : (curriculumReviewers[q.subject.curriculum.id] ?? [])
          }
        />
      ))}
    </div>
  )
}

function ReviewRow({
  q, currentUserId, peers,
}: {
  q: QueueItem
  currentUserId: string
  peers: ReviewerStub[]
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [reassignTo, setReassignTo] = useState("")
  const [error, setError] = useState<string | null>(null)

  const isOwn = q.authorId === currentUserId
  const reassignCandidates = peers.filter((p) => p.id !== currentUserId)

  async function act(action: "approve" | "needs_changes" | "reject" | "reassign") {
    setError(null)
    setBusy(action)
    try {
      const body: Record<string, unknown> = { action }
      if (action === "needs_changes" || action === "reject") {
        if (!note.trim()) { setError("A note is required."); setBusy(null); return }
        body.note = note.trim()
      }
      if (action === "reassign") {
        if (!reassignTo) { setError("Pick a reviewer to hand off to."); setBusy(null); return }
        body.reassignToUserId = reassignTo
      }
      const res = await fetch(`/api/admin/questions/${q.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Action failed.")
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Row header — collapsed summary */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              {TIER_LABEL[q.status]}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {q.subject.curriculum.code} · {q.subject.name}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {q.chapter.name}{q.unit ? ` · ${q.unit.name}` : ""}{q.year ? ` · ${q.year}` : ""}
            </span>
          </div>
          <div className="mt-2 line-clamp-2 text-sm text-slate-700 dark:text-slate-300">
            {firstTextLine(q.stem)}
          </div>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            By {q.author ? `${q.author.firstName} ${q.author.lastName}` : "—"}
          </p>
        </div>
        <span className="text-xs text-slate-400">{expanded ? "▴" : "▾"}</span>
      </button>

      {/* Expanded — full preview + decision panel */}
      {expanded && (
        <div className="border-t border-slate-200 px-5 py-5 dark:border-slate-800">
          {isOwn && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-400">
              You are the author. You cannot decide on your own question — reassign to a peer.
            </p>
          )}

          {/* Question preview */}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ContentBlockList blocks={q.stem as ContentBlock[]} variant="stem" />
          </div>

          <ol className="mt-4 space-y-2">
            {q.options.map((opt, i): ReactElement => {
              const optContent = opt.content as ContentBlock
              return (
                <li
                  key={opt.id}
                  className={[
                    "flex items-start gap-3 rounded-lg border px-3 py-2 text-sm",
                    opt.isCorrect
                      ? "border-lime-300 bg-lime-50 dark:border-lime-700 dark:bg-lime-950/20"
                      : "border-slate-200 dark:border-slate-800",
                  ].join(" ")}
                >
                  <span className="font-mono text-xs font-bold text-slate-500">{String.fromCharCode(65 + i)}.</span>
                  <div className="flex-1">
                    <ContentBlockView block={optContent} variant="option" />
                  </div>
                  {opt.isCorrect && (
                    <span className="rounded bg-lime-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-800 dark:bg-lime-800/40 dark:text-lime-300">
                      Correct
                    </span>
                  )}
                </li>
              )
            })}
          </ol>

          {Array.isArray(q.explanation) && (q.explanation as ContentBlock[]).length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Explanation</p>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ContentBlockList blocks={q.explanation as ContentBlock[]} variant="explanation" />
              </div>
            </div>
          )}

          {/* Note + decision actions */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Note (required for Request Changes / Reject)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Explain what needs to change…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />

            {error && (
              <p className="mt-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-400">
                {error}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                disabled={isOwn || !!busy}
                onClick={() => act("approve")}
                className="rounded-lg border-b-4 border-lime-700 bg-lime-500 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2 disabled:opacity-50"
              >
                {busy === "approve" ? "Approving…" : "Approve"}
              </button>
              <button
                disabled={!!busy}
                onClick={() => act("needs_changes")}
                className="rounded-lg border-b-4 border-amber-700 bg-amber-500 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-amber-400 active:translate-y-px active:border-b-2 disabled:opacity-50"
              >
                Request Changes
              </button>
              <button
                disabled={!!busy}
                onClick={() => act("reject")}
                className="rounded-lg border-b-4 border-rose-700 bg-rose-500 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-rose-400 active:translate-y-px active:border-b-2 disabled:opacity-50"
              >
                Reject
              </button>

              <div className="ml-auto flex items-center gap-2">
                <select
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">Reassign to…</option>
                  {reassignCandidates.map((p) => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
                <button
                  disabled={!reassignTo || !!busy}
                  onClick={() => act("reassign")}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Reassign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Pull the first short text snippet from a stem ContentBlock[] for the collapsed row.
function firstTextLine(stem: unknown): string {
  if (!Array.isArray(stem)) return "(no stem)"
  for (const b of stem as ContentBlock[]) {
    if (b.kind === "text" && typeof b.text === "string") return b.text
  }
  return "(math/image-only stem)"
}
