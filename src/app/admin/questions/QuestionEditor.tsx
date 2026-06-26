"use client"

import { useRouter } from "next/navigation"
import { useState, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import type { ContentBlock } from "@/lib/questions/types"
import { QuestionPreview } from "./QuestionPreview"
import { HelpPanel } from "./HelpPanel"

// ─── Types ───────────────────────────────────────────────────────────────────

type Subject = {
  id: string
  name: string
  code: string
  curriculumId: string
  curriculum: { code: string; displayName: string }
}
type Chapter = { id: string; name: string }
type Unit    = { id: string; name: string }

type OptionDraft = {
  id?: string
  content: ContentBlock
  isCorrect: boolean
  rationale: string
  sortOrder: number
}

type EditorProps = {
  mode: "new" | "edit"
  questionId?: string
  // initial values (for edit mode)
  initial?: {
    subjectId: string
    chapterId: string
    unitId?: string
    year?: number | null
    stem: ContentBlock[]
    options: OptionDraft[]
    explanation: ContentBlock[]
    difficulty: string
    allowMultipleCorrect: boolean
    tags: string[]
    sourceNote: string
    aiAssisted: boolean
  }
  subjects: Subject[]
  // chapters + units are fetched client-side after subject pick
  initialChapters?: Chapter[]
  initialUnits?: Unit[]
}

// ─── Default empty state ─────────────────────────────────────────────────────

function emptyOption(sortOrder: number): OptionDraft {
  return { content: { kind: "text", text: "" }, isCorrect: false, rationale: "", sortOrder }
}

function defaultInitial() {
  return {
    subjectId: "", chapterId: "", unitId: "", year: null as number | null,
    stem: [{ kind: "text" as const, text: "" }],
    options: [emptyOption(0), emptyOption(1), emptyOption(2), emptyOption(3)],
    explanation: [] as ContentBlock[],
    difficulty: "MEDIUM",
    allowMultipleCorrect: false,
    tags: [] as string[],
    sourceNote: "",
    aiAssisted: false,
  }
}

// ─── Block builder ────────────────────────────────────────────────────────────

function BlockEditor({
  blocks,
  onChange,
  label,
}: {
  blocks: ContentBlock[]
  onChange: (b: ContentBlock[]) => void
  label: string
}) {
  function updateBlock(i: number, block: ContentBlock) {
    const next = [...blocks]
    next[i] = block
    onChange(next)
  }

  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  function addText() { onChange([...blocks, { kind: "text", text: "" }]) }
  function addMath() { onChange([...blocks, { kind: "math", latex: "", display: true }]) }
  function remove(i: number) { onChange(blocks.filter((_, idx) => idx !== i)) }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    const res = await fetch("/api/upload", { method: "POST", body: fd })
    if (res.ok) {
      const { url } = await res.json()
      const isSvg = file.type === "image/svg+xml"
      const block: ContentBlock = isSvg
        ? { kind: "graph", url, alt: file.name, format: "svg" }
        : { kind: "image", url, alt: file.name, aspect: "wide" }
      onChange([...blocks, block])
    }
    setUploading(false)
    e.target.value = ""
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      {blocks.map((block, i) => (
        <div key={i} className="flex gap-2">
          <div className="flex-1 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                {block.kind}
              </span>
              {block.kind === "math" && (
                <label className="flex items-center gap-1 text-[11px] text-slate-500">
                  <input
                    type="checkbox"
                    checked={block.display}
                    onChange={(e) => updateBlock(i, { ...block, display: e.target.checked })}
                    className="accent-lime-600"
                  />
                  display mode
                </label>
              )}
              {(block.kind === "image" || block.kind === "graph") && (
                <input
                  type="text"
                  value={block.alt}
                  onChange={(e) => updateBlock(i, { ...block, alt: e.target.value })}
                  placeholder="Alt text"
                  className="flex-1 rounded bg-transparent text-[11px] text-slate-500 placeholder:text-slate-300 focus:outline-none"
                />
              )}
            </div>
            {block.kind === "text" && (
              <textarea
                value={block.text}
                onChange={(e) => updateBlock(i, { kind: "text", text: e.target.value })}
                placeholder="Enter text…"
                rows={2}
                className="w-full resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-600"
              />
            )}
            {block.kind === "math" && (
              <textarea
                value={block.latex}
                onChange={(e) => updateBlock(i, { ...block, latex: e.target.value })}
                placeholder="LaTeX, e.g. \frac{1}{2}mv^2"
                rows={2}
                className="w-full resize-none font-mono bg-transparent text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-600"
              />
            )}
            {(block.kind === "image" || block.kind === "graph") && (
              <img src={block.url} alt={block.alt} className="mt-2 max-h-40 rounded-lg object-contain" />
            )}
          </div>
          <button
            type="button"
            onClick={() => remove(i)}
            className="mt-1 self-start rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/20"
            aria-label="Remove block"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
      <input ref={fileRef} type="file" accept="image/*,.svg" className="hidden" onChange={handleImageUpload} />
      <div className="flex gap-2">
        <button type="button" onClick={addText}
          className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:text-slate-300">
          + Text
        </button>
        <button type="button" onClick={addMath}
          className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:text-slate-300">
          + Math (LaTeX)
        </button>
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:text-slate-300">
          {uploading ? "Uploading…" : "+ Image / SVG"}
        </button>
      </div>
    </div>
  )
}

// ─── Option editor ────────────────────────────────────────────────────────────

function OptionEditor({
  options,
  allowMultiple,
  onChange,
}: {
  options: OptionDraft[]
  allowMultiple: boolean
  onChange: (opts: OptionDraft[]) => void
}) {
  const LABELS = ["A", "B", "C", "D", "E"]

  function updateContent(i: number, content: ContentBlock) {
    const next = [...options]
    next[i] = { ...next[i], content }
    onChange(next)
  }

  function updateRationale(i: number, rationale: string) {
    const next = [...options]
    next[i] = { ...next[i], rationale }
    onChange(next)
  }

  function toggleCorrect(i: number) {
    const next = [...options]
    if (allowMultiple) {
      next[i] = { ...next[i], isCorrect: !next[i].isCorrect }
    } else {
      next.forEach((o, idx) => { next[idx] = { ...o, isCorrect: idx === i } })
    }
    onChange(next)
  }

  function addOption() {
    onChange([...options, emptyOption(options.length)])
  }

  function removeOption(i: number) {
    if (options.length <= 2) return
    onChange(options.filter((_, idx) => idx !== i).map((o, idx) => ({ ...o, sortOrder: idx })))
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Answer options</p>
      {options.map((opt, i) => (
        <div
          key={i}
          className={cn(
            "rounded-xl border p-3 transition",
            opt.isCorrect
              ? "border-lime-400 bg-lime-50 dark:border-lime-700 dark:bg-lime-950/20"
              : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/30"
          )}
        >
          <div className="mb-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => toggleCorrect(i)}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-black transition",
                opt.isCorrect
                  ? "border-lime-500 bg-lime-500 text-white"
                  : "border-slate-300 text-slate-400 hover:border-lime-400 dark:border-slate-600"
              )}
              title={opt.isCorrect ? "Correct answer" : "Mark as correct"}
            >
              {LABELS[i]}
            </button>
            <span className="flex-1 text-xs text-slate-400">
              {opt.isCorrect ? "Correct" : "Distractor"}
            </span>
            {options.length > 2 && (
              <button type="button" onClick={() => removeOption(i)}
                className="text-slate-300 hover:text-rose-400 dark:text-slate-600 dark:hover:text-rose-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          {opt.content.kind === "text" ? (
            <textarea
              value={opt.content.text}
              onChange={(e) => updateContent(i, { kind: "text", text: e.target.value })}
              placeholder={`Option ${LABELS[i]}…`}
              rows={2}
              className="w-full resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-600"
            />
          ) : opt.content.kind === "math" ? (
            <textarea
              value={opt.content.latex}
              onChange={(e) => updateContent(i, { kind: "math", latex: e.target.value, display: opt.content.kind === "math" ? opt.content.display : false })}
              placeholder="LaTeX…"
              rows={2}
              className="w-full resize-none font-mono bg-transparent text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-600"
            />
          ) : null}
          <input
            type="text"
            value={opt.rationale}
            onChange={(e) => updateRationale(i, e.target.value)}
            placeholder="Optional rationale shown when student picks this option…"
            className="mt-2 w-full border-t border-slate-100 bg-transparent pt-2 text-xs text-slate-500 placeholder:text-slate-300 focus:outline-none dark:border-slate-700 dark:placeholder:text-slate-600"
          />
        </div>
      ))}
      {options.length < 6 && (
        <button type="button" onClick={addOption}
          className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-slate-400 dark:border-slate-600">
          + Add option
        </button>
      )}
    </div>
  )
}

// ─── Main editor ──────────────────────────────────────────────────────────────

export function QuestionEditor({ mode, questionId, initial, subjects, initialChapters = [], initialUnits = [] }: EditorProps) {
  const router = useRouter()
  const init = initial ?? defaultInitial()

  const [form, setForm] = useState({
    subjectId:          init.subjectId,
    chapterId:          init.chapterId,
    unitId:             init.unitId ?? "",
    year:               init.year ?? null as number | null,
    stem:               init.stem,
    options:            init.options,
    explanation:        init.explanation,
    difficulty:         init.difficulty,
    allowMultipleCorrect: init.allowMultipleCorrect,
    tags:               init.tags.join(", "),
    sourceNote:         init.sourceNote,
    aiAssisted:         init.aiAssisted,
  })

  // Derived curriculum filter for the Subject dropdown
  const curriculaInSubjects = [...new Map(
    subjects.map((s) => [s.curriculumId, { id: s.curriculumId, code: s.curriculum.code, displayName: s.curriculum.displayName }])
  ).values()]
  const [curriculumFilter, setCurriculumFilter] = useState<string>(() => {
    if (!init.subjectId) return ""
    return subjects.find((s) => s.id === init.subjectId)?.curriculumId ?? ""
  })

  const [chapters, setChapters] = useState<Chapter[]>(initialChapters)
  const [units, setUnits] = useState<Unit[]>(initialUnits)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [statusTarget, setStatusTarget] = useState<string | null>(null)

  const set = useCallback((key: string, val: unknown) => setForm((f) => ({ ...f, [key]: val })), [])

  async function loadChapters(subjectId: string) {
    if (!subjectId) { setChapters([]); setUnits([]); return }
    const res = await fetch(`/api/admin/subjects/${subjectId}/chapters`)
    if (res.ok) setChapters(await res.json())
    else setChapters([])
    setUnits([])
    set("chapterId", "")
    set("unitId", "")
  }

  async function loadUnits(chapterId: string) {
    if (!chapterId) { setUnits([]); return }
    const res = await fetch(`/api/admin/chapters/${chapterId}/units`)
    if (res.ok) setUnits(await res.json())
    else setUnits([])
    set("unitId", "")
  }

  // action: "submit" — DRAFT → review pipeline; "approve" — published (admin only)
  async function save(action?: "submit" | "approve") {
    setError("")
    setSaving(true)
    setStatusTarget(action ?? null)

    const payload = {
      subjectId: form.subjectId,
      chapterId: form.chapterId,
      unitId: form.unitId || null,
      year: form.year || null,
      stem: form.stem,
      options: form.options.map((o, i) => ({ ...o, sortOrder: i })),
      explanation: form.explanation,
      difficulty: form.difficulty,
      allowMultipleCorrect: form.allowMultipleCorrect,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      sourceNote: form.sourceNote || null,
      aiAssisted: form.aiAssisted,
    }

    try {
      let res: Response
      if (mode === "new") {
        res = await fetch("/api/admin/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch(`/api/admin/questions/${questionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to save.")
        setSaving(false)
        return
      }

      const data = await res.json()
      const id = data.id ?? questionId!

      // Optionally advance through the review pipeline.
      // "submit" routes the draft via the lifecycle helper — it picks the right
      // tier (subject vs curriculum) based on what reviewers are assigned.
      if (action) {
        await fetch(`/api/admin/questions/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        })
      }

      router.push("/admin/questions")
      router.refresh()
    } catch {
      setError("Network error. Please try again.")
      setSaving(false)
    }
  }

  const disableSave = saving || !form.subjectId || !form.chapterId || form.stem.every(
    (b) => (b.kind === "text" && !b.text.trim()) || (b.kind === "math" && !b.latex.trim())
  ) || !form.options.some((o) => o.isCorrect)

  const [tab, setTab] = useState<"edit" | "preview">("edit")
  const [showHelp, setShowHelp] = useState(false)

  return (
    <div className="space-y-4">
      {/* Edit / Preview tabs + Help button */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 w-fit rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
          {(["edit", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-lg px-5 py-1.5 text-sm font-semibold transition capitalize",
                tab === t
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          title="Editor help & LaTeX reference"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-500 transition hover:border-lime-400 hover:text-lime-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-lime-600 dark:hover:text-lime-400"
        >
          ?
        </button>
      </div>

      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

    {tab === "preview" ? (
      <QuestionPreview
        stem={form.stem}
        options={form.options}
        explanation={form.explanation}
        allowMultipleCorrect={form.allowMultipleCorrect}
        difficulty={form.difficulty}
      />
    ) : (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      {/* Main column */}
      <div className="space-y-8">
        {/* Stem */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <BlockEditor
            label="Question stem"
            blocks={form.stem}
            onChange={(b) => set("stem", b)}
          />
        </section>

        {/* Options */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={form.allowMultipleCorrect}
                onChange={(e) => set("allowMultipleCorrect", e.target.checked)}
                className="accent-lime-600"
              />
              Allow multiple correct options
            </label>
          </div>
          <OptionEditor
            options={form.options}
            allowMultiple={form.allowMultipleCorrect}
            onChange={(opts) => set("options", opts)}
          />
        </section>

        {/* Explanation */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <BlockEditor
            label="Explanation (shown after answer)"
            blocks={form.explanation}
            onChange={(b) => set("explanation", b)}
          />
        </section>

        {/* Error */}
        {error && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={disableSave}
            onClick={() => save()}
            className="rounded-xl border-b-4 border-lime-700 bg-lime-500 px-5 py-2.5 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && !statusTarget ? "Saving…" : mode === "new" ? "Save as draft" : "Save changes"}
          </button>
          {mode === "new" ? (
            <button
              type="button"
              disabled={disableSave}
              onClick={() => save("submit")}
              className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
            >
              {saving && statusTarget === "submit" ? "Submitting…" : "Save & submit for review"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => router.back()}
            className="ml-auto text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Sidebar metadata */}
      <aside className="space-y-5">
        {/* Taxonomy */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Taxonomy</p>
          <div className="space-y-3">
            {/* Curriculum (cascading filter — not stored directly) */}
            <div>
              <label className="mb-1 block text-xs text-slate-500">Curriculum</label>
              <select
                value={curriculumFilter}
                onChange={(e) => {
                  setCurriculumFilter(e.target.value)
                  // Reset subject/chapter/unit if it doesn't belong to new curriculum
                  const currentSubject = subjects.find((s) => s.id === form.subjectId)
                  if (currentSubject && e.target.value && currentSubject.curriculumId !== e.target.value) {
                    set("subjectId", "")
                    set("chapterId", "")
                    set("unitId", "")
                    setChapters([])
                    setUnits([])
                  }
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <option value="">All curricula</option>
                {curriculaInSubjects.map((c) => (
                  <option key={c.id} value={c.id}>{c.displayName}</option>
                ))}
              </select>
            </div>
            {/* Subject */}
            <div>
              <label className="mb-1 block text-xs text-slate-500">Subject *</label>
              <select
                value={form.subjectId}
                onChange={(e) => {
                  set("subjectId", e.target.value)
                  loadChapters(e.target.value)
                  const s = subjects.find((s) => s.id === e.target.value)
                  if (s && !curriculumFilter) setCurriculumFilter(s.curriculumId)
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <option value="">Select subject…</option>
                {subjects
                  .filter((s) => !curriculumFilter || s.curriculumId === curriculumFilter)
                  .map((s) => <option key={s.id} value={s.id}>{s.name}</option>)
                }
              </select>
            </div>
            {/* Chapter */}
            <div>
              <label className="mb-1 block text-xs text-slate-500">Chapter *</label>
              <select
                value={form.chapterId}
                disabled={!chapters.length}
                onChange={(e) => { set("chapterId", e.target.value); loadUnits(e.target.value) }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <option value="">Select chapter…</option>
                {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {/* Unit */}
            {units.length > 0 && (
              <div>
                <label className="mb-1 block text-xs text-slate-500">Unit (optional)</label>
                <select
                  value={form.unitId}
                  onChange={(e) => set("unitId", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <option value="">None</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            {/* Build Year */}
            <div>
              <label className="mb-1 block text-xs text-slate-500">Build year</label>
              <select
                value={form.year ?? ""}
                onChange={(e) => set("year", e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <option value="">— none —</option>
                {Array.from(
                  { length: new Date().getFullYear() + 1 - 2015 + 1 },
                  (_, i) => new Date().getFullYear() + 1 - i
                ).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Difficulty */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Difficulty</p>
          <div className="grid grid-cols-2 gap-2">
            {(["EASY", "MEDIUM", "HARD", "CHALLENGE"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set("difficulty", d)}
                className={cn(
                  "rounded-lg px-2 py-2 text-xs font-semibold transition",
                  form.difficulty === d
                    ? d === "EASY"    ? "bg-lime-100 text-lime-700 ring-2 ring-lime-400 dark:bg-lime-950/30 dark:text-lime-400"
                    : d === "MEDIUM"  ? "bg-sky-100 text-sky-700 ring-2 ring-sky-400 dark:bg-sky-950/30 dark:text-sky-400"
                    : d === "HARD"    ? "bg-orange-100 text-orange-700 ring-2 ring-orange-400 dark:bg-orange-950/30 dark:text-orange-400"
                                      : "bg-rose-100 text-rose-700 ring-2 ring-rose-400 dark:bg-rose-950/30 dark:text-rose-400"
                    : "border border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400"
                )}
              >
                {d === "CHALLENGE" ? "Challenge" : d.charAt(0) + d.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Tags & meta */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tags & attribution</p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Tags (comma-separated)</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="kinematics, Paper 2, 2024…"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Source note</label>
              <input
                type="text"
                value={form.sourceNote}
                onChange={(e) => set("sourceNote", e.target.value)}
                placeholder="Original — Dr Smith"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:placeholder:text-slate-600"
              />
              <p className="mt-1 text-[10px] text-slate-400">Never store verbatim past-paper text.</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={form.aiAssisted}
                onChange={(e) => set("aiAssisted", e.target.checked)}
                className="accent-lime-600"
              />
              AI-assisted draft
            </label>
          </div>
        </div>
      </aside>
    </div>
    )}
    </div>
  )
}
