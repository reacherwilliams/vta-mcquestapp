"use client"

import { useRouter } from "next/navigation"

type Subject = { id: string; name: string; code: string; curriculumId: string }
type Curriculum = { id: string; code: string; displayName: string }

// Curriculum → Subject cascade for the coverage page. Mirrors the editor / QA
// filters: picking a curriculum narrows the subject list and navigates.
export function CoverageFilters({
  curricula,
  subjects,
  curriculumId,
  subjectId,
}: {
  curricula: Curriculum[]
  subjects: Subject[]
  curriculumId: string
  subjectId: string
}) {
  const router = useRouter()
  const visibleSubjects = curriculumId ? subjects.filter((s) => s.curriculumId === curriculumId) : subjects

  function go(next: { curriculumId?: string; subjectId?: string }) {
    const params = new URLSearchParams()
    const cid = next.curriculumId ?? curriculumId
    if (cid) params.set("curriculumId", cid)
    // Changing the curriculum clears the subject so the page re-defaults to its first.
    const sid = "subjectId" in next ? next.subjectId : next.curriculumId !== undefined ? "" : subjectId
    if (sid) params.set("subjectId", sid)
    router.push(`/admin/coverage${params.toString() ? `?${params}` : ""}`)
  }

  const cls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Curriculum</label>
        <select value={curriculumId} onChange={(e) => go({ curriculumId: e.target.value })} className={cls}>
          <option value="">All curricula</option>
          {curricula.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</label>
        <select value={subjectId} onChange={(e) => go({ subjectId: e.target.value })} className={cls}>
          {visibleSubjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.code ? ` · ${s.code}` : ""}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
