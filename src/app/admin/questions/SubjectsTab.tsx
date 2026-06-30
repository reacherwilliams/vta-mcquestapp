"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"

type SubjectRow = {
  id: string
  code: string
  syllabusCode: string | null
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  hasFrq: boolean
  curriculumId: string
  curriculum: { id: string; code: string; displayName: string }
  _count: { chapters: number; questions: number }
}

type CurriculumOption = {
  id: string
  code: string
  displayName: string
}

type Props = {
  subjects: SubjectRow[]
  curricula: CurriculumOption[]
  curriculumId: string
}

const EMPTY_FORM = {
  curriculumId: "",
  code: "",
  syllabusCode: "",
  name: "",
  description: "",
  sortOrder: 0,
  hasFrq: false,
  isActive: true,
}

export function SubjectsTab({ subjects, curricula, curriculumId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [slideOver, setSlideOver] = useState<"add" | "edit" | null>(null)
  const [editing, setEditing] = useState<SubjectRow | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM, curriculumId: curriculumId || (curricula[0]?.id ?? "") })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SubjectRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openAdd() {
    setForm({ ...EMPTY_FORM, curriculumId: curriculumId || (curricula[0]?.id ?? "") })
    setEditing(null)
    setError(null)
    setSlideOver("add")
  }

  // Open slide-over when heading button sets ?action=add
  useEffect(() => {
    if (searchParams.get("action") === "add" && slideOver === null) {
      openAdd()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function openEdit(s: SubjectRow) {
    setForm({
      curriculumId: s.curriculumId,
      code: s.code,
      syllabusCode: s.syllabusCode ?? "",
      name: s.name,
      description: s.description ?? "",
      sortOrder: s.sortOrder,
      hasFrq: s.hasFrq,
      isActive: s.isActive,
    })
    setEditing(s)
    setError(null)
    setSlideOver("edit")
  }

  function closeSlideOver() {
    setSlideOver(null)
    setEditing(null)
    setError(null)
    if (searchParams.get("action")) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("action")
      router.replace(`/admin/questions?${params.toString()}`)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const isEdit = slideOver === "edit" && editing
      const url = isEdit ? `/api/admin/subjects/${editing.id}` : "/api/admin/subjects"
      const method = isEdit ? "PATCH" : "POST"

      const body = {
        curriculumId: form.curriculumId,
        code: form.code.trim(),
        syllabusCode: form.syllabusCode.trim() || null,
        name: form.name.trim(),
        description: form.description.trim() || null,
        sortOrder: Number(form.sortOrder),
        hasFrq: form.hasFrq,
        isActive: form.isActive,
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Something went wrong.")
        return
      }

      closeSlideOver()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/subjects/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Delete failed.")
        return
      }
      setDeleteTarget(null)
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  function clearCurriculumFilter() {
    const params = new URLSearchParams()
    params.set("tab", "subjects")
    router.push(`/admin/questions?${params.toString()}`)
  }

  function goToQuestions(subject: SubjectRow) {
    const params = new URLSearchParams()
    params.set("tab", "questions")
    params.set("subjectId", subject.id)
    // Carry curriculumId so "Subjects" tab link can restore the filter on back-navigation
    params.set("curriculumId", subject.curriculumId)
    router.push(`/admin/questions?${params.toString()}`)
  }

  const activeCurriculum = curricula.find((c) => c.id === curriculumId)

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Active filter chip */}
        {activeCurriculum && (
          <div className="flex items-center gap-1.5 rounded-full border border-lime-200 bg-lime-50 px-3 py-1 text-xs font-semibold text-lime-800 dark:border-lime-800/40 dark:bg-lime-950/20 dark:text-lime-400">
            <span>{activeCurriculum.displayName}</span>
            <button
              onClick={clearCurriculumFilter}
              className="ml-0.5 rounded-full p-0.5 hover:bg-lime-200 dark:hover:bg-lime-900/40"
              aria-label="Clear curriculum filter"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {subjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-400 dark:border-slate-700">
          No subjects found{activeCurriculum ? ` for ${activeCurriculum.displayName}` : ""}. Add one to get started.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-800 dark:bg-slate-900/60">
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Curriculum</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Code</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Syllabus</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Name</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Description</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Chapters</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Questions</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">FRQ</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {subjects.map((s) => (
                <tr key={s.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-lime-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-lime-800 dark:bg-lime-950/40 dark:text-lime-400">
                      {s.curriculum.code}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {s.code}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {s.syllabusCode ? (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {s.syllabusCode}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => goToQuestions(s)}
                      className="font-medium text-slate-800 hover:text-lime-700 hover:underline transition-colors dark:text-slate-200 dark:hover:text-lime-400"
                    >
                      {s.name}
                    </button>
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{s.description ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {s._count.chapters}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => goToQuestions(s)}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-lime-100 hover:text-lime-700 transition-colors dark:bg-slate-800 dark:text-slate-400"
                    >
                      {s._count.questions.toLocaleString()}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {s.hasFrq ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        FRQ
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300 dark:text-slate-700">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        s.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500",
                      ].join(" ")}
                    >
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(s)}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { setDeleteTarget(s); setError(null) }}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/20"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Delete subject?</h3>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              This will permanently delete <strong>{deleteTarget.name}</strong>.
              {deleteTarget._count.questions > 0 && (
                <span className="mt-1 block text-rose-600 dark:text-rose-400">
                  Warning: this subject has {deleteTarget._count.questions} question(s) — deletion will be blocked.
                </span>
              )}
            </p>
            {error && (
              <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-400">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setError(null) }}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over panel */}
      {slideOver && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={closeSlideOver} />
          <div className="relative flex h-full w-full max-w-[400px] flex-col bg-white shadow-2xl dark:bg-slate-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {slideOver === "add" ? "Add Subject" : "Edit Subject"}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {slideOver === "add" ? "Create a new subject" : `Editing ${editing?.code}`}
                </p>
              </div>
              <button
                onClick={closeSlideOver}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-400">
                  {error}
                </div>
              )}

              {/* Curriculum */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Curriculum <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.curriculumId}
                  onChange={(e) => setForm((f) => ({ ...f, curriculumId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {curricula.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.displayName}</option>
                  ))}
                </select>
              </div>

              {/* Code */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Subject Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. PHY, MATH, BIO"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-700 placeholder-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:placeholder-slate-500"
                />
              </div>

              {/* Syllabus code (CAIE) */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Syllabus code
                </label>
                <input
                  type="text"
                  value={form.syllabusCode}
                  onChange={(e) => setForm((f) => ({ ...f, syllabusCode: e.target.value.trim() }))}
                  placeholder="e.g. 0610, 9700 (Cambridge only)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-700 placeholder-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:placeholder-slate-500"
                />
              </div>

              {/* Name */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Physics"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:placeholder-slate-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Brief description of this subject…"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:placeholder-slate-500"
                />
              </div>

              {/* Sort Order */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                />
              </div>

              {/* hasFrq */}
              <div className="flex items-center gap-3">
                <input
                  id="subj-hasFrq"
                  type="checkbox"
                  checked={form.hasFrq}
                  onChange={(e) => setForm((f) => ({ ...f, hasFrq: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-lime-500 focus:ring-lime-500"
                />
                <label htmlFor="subj-hasFrq" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Has FRQ (Free Response Questions)
                </label>
              </div>

              {/* isActive */}
              <div className="flex items-center gap-3">
                <input
                  id="subj-isActive"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-lime-500 focus:ring-lime-500"
                />
                <label htmlFor="subj-isActive" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Active
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeSlideOver}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim() || !form.code.trim() || !form.curriculumId}
                  className="rounded-xl border-b-4 border-lime-700 bg-lime-500 px-4 py-2 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving…" : slideOver === "add" ? "Create" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
