"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SwissQuestionCard } from "@/components/questions/swiss-question-card"
import type { DemoQuestion } from "@/lib/questions/demo-data"
import { cn } from "@/lib/utils"

type QaItem = {
  id: string
  status: string
  subjectName: string
  chapterName: string
  difficulty: string
  stemPreview: string
  display: DemoQuestion
}
type Subject = { id: string; name: string; curriculumCode: string }

type Props = {
  items: QaItem[]
  subjects: Subject[]
  status: "IN_QA" | "PUBLISHED"
  subjectId: string
  cappedAt: number | null
}

const DIFFICULTY_BADGE: Record<string, string> = {
  EASY:      "bg-lime-50 text-lime-700 dark:bg-lime-950/30 dark:text-lime-400",
  MEDIUM:    "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400",
  HARD:      "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  CHALLENGE: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
}

export function QaClient({ items, subjects, status, subjectId, cappedAt }: Props) {
  const router = useRouter()
  const [testing, setTesting] = useState<number | null>(null)
  const [acted, setActed] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState(false)
  const [sendBackOpen, setSendBackOpen] = useState(false)
  const [note, setNote] = useState("")

  function setFilter(next: { status?: string; subjectId?: string }) {
    const params = new URLSearchParams()
    params.set("status", next.status ?? status)
    const sid = next.subjectId ?? subjectId
    if (sid) params.set("subjectId", sid)
    router.push(`/admin/qa?${params.toString()}`)
  }

  function advance() {
    if (testing === null) return
    const next = testing + 1
    if (next < items.length) {
      setTesting(next)
    } else {
      setTesting(null)
      router.refresh()
    }
  }

  async function act(id: string, action: string, noteText?: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/questions/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(noteText ? { note: noteText } : {}) }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error ?? "Action failed.")
        return
      }
      setActed((prev) => new Set(prev).add(id))
      setSendBackOpen(false)
      setNote("")
      advance()
    } finally {
      setBusy(false)
    }
  }

  // ── Test-play view ─────────────────────────────────────────────────────────
  if (testing !== null && items[testing]) {
    const item = items[testing]
    const isQa = item.status === "IN_QA"

    const actionBtn = "rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition disabled:opacity-50"

    const revealFooter = (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isQa ? (
          <>
            <button disabled={busy} onClick={() => act(item.id, "pass_qa")} className={cn(actionBtn, "bg-emerald-500 text-white hover:bg-emerald-400")}>
              ✓ Pass QA
            </button>
            <button disabled={busy} onClick={() => setSendBackOpen(true)} className={cn(actionBtn, "border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/30")}>
              Send back
            </button>
          </>
        ) : (
          <button disabled={busy} onClick={() => act(item.id, "archive")} className={cn(actionBtn, "border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/30")}>
            Archive (pull from students)
          </button>
        )}
        <button disabled={busy} onClick={advance} className={cn(actionBtn, "border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800")}>
          {testing + 1 < items.length ? "Skip →" : "Done"}
        </button>
      </div>
    )

    return (
      <div className="relative">
        {/* Back-to-queue bar */}
        <button
          onClick={() => setTesting(null)}
          className="fixed left-4 top-4 z-50 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500 shadow-sm backdrop-blur transition hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:text-slate-200"
        >
          ← Queue
        </button>

        <SwissQuestionCard
          key={item.id}
          question={item.display}
          currentIndex={testing}
          total={items.length}
          nextHref="#"
          accent="lime"
          hideConfidence
          onExit={() => setTesting(null)}
          onAnswered={() => { /* sandbox — QA test runs record nothing */ }}
          revealFooter={revealFooter}
        />

        {sendBackOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6" onClick={() => setSendBackOpen(false)}>
            <div className="w-full max-w-md rounded-2xl bg-white p-5 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Send back to author</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">This returns the question to DRAFT. Tell the author what to fix.</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="e.g. Option C is also arguably correct; tighten the wording."
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => setSendBackOpen(false)} className="rounded-full px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancel</button>
                <button
                  disabled={busy || !note.trim()}
                  onClick={() => act(item.id, "fail_qa", note.trim())}
                  className="rounded-full bg-rose-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-rose-400 disabled:opacity-50"
                >
                  Send back
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Queue list view ──────────────────────────────────────────────────────────
  const remaining = items.filter((it) => !acted.has(it.id))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">QA Testing</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Play through questions as a student would, then pass them live or send them back.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 p-1 dark:border-slate-800">
          {([
            { key: "IN_QA", label: "QA Testing" },
            { key: "PUBLISHED", label: "Published" },
          ] as const).map((s) => (
            <button
              key={s.key}
              onClick={() => setFilter({ status: s.key })}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                status === s.key
                  ? "bg-lime-100 text-lime-800 dark:bg-lime-950/40 dark:text-lime-300"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <select
            value={subjectId}
            onChange={(e) => setFilter({ subjectId: e.target.value })}
            className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-10 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.curriculumCode} — {s.name}</option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        {remaining.length > 0 && (
          <button
            onClick={() => setTesting(0)}
            className="ml-auto rounded-full bg-lime-500 px-5 py-2 text-xs font-bold uppercase tracking-widest text-slate-900 transition hover:bg-lime-400"
          >
            Test all ({remaining.length}) →
          </button>
        )}
      </div>

      {cappedAt && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">Showing the {cappedAt} most recent — narrow by subject to see the rest.</p>
      )}

      {/* List */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400 dark:border-slate-700">
          {status === "IN_QA" ? "Nothing awaiting QA right now 🎉" : "No published questions match this filter."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((it, i) => (
              <li key={it.id} className={cn("flex items-center gap-4 px-4 py-3", acted.has(it.id) && "opacity-40")}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-800 dark:text-slate-200">{it.stemPreview}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{it.subjectName} · {it.chapterName}</p>
                </div>
                <span className={cn("hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline", DIFFICULTY_BADGE[it.difficulty] ?? "")}>
                  {it.difficulty}
                </span>
                <button
                  disabled={acted.has(it.id)}
                  onClick={() => setTesting(i)}
                  className="shrink-0 rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-lime-500 hover:text-lime-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:text-lime-400"
                >
                  {acted.has(it.id) ? "Done" : "Test →"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
