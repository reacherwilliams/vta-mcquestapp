"use client"

import { useMemo, useState } from "react"

export type Topic = { id: string; parentId: string | null; code: string; title: string; level: number }

const levelLabel = (lvl: number) => (lvl === 1 ? "area" : lvl === 2 ? "sub-topic" : lvl === 3 ? "standard" : `level ${lvl}`)

// Topic picker for a deep syllabus tree: cascading selects (drill Area -> Sub-topic
// -> Standard, stop at any level) + a search box that jumps to any node.
export function TopicPicker({ topics, value, onChange }: { topics: Topic[]; value: string; onChange: (id: string) => void }) {
  const byId = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics])
  // children keyed by parentId, preserving the API's sortOrder.
  const childrenOf = useMemo(() => {
    const m = new Map<string | null, Topic[]>()
    for (const t of topics) {
      const arr = m.get(t.parentId) ?? []
      arr.push(t)
      m.set(t.parentId, arr)
    }
    return m
  }, [topics])

  // root → value chain (so the cascade reflects the current selection).
  const path = useMemo(() => {
    const p: Topic[] = []
    let cur = value ? byId.get(value) : undefined
    while (cur) { p.unshift(cur); cur = cur.parentId ? byId.get(cur.parentId) : undefined }
    return p
  }, [value, byId])

  const [query, setQuery] = useState("")
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return topics.filter((t) => t.code.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)).slice(0, 40)
  }, [query, topics])

  // Build cascade slots: roots, then the children of each selected node.
  const slots: { idx: number; level: number; options: Topic[]; selectedId: string }[] = []
  {
    let parentKey: string | null = null
    let idx = 0
    for (;;) {
      const options = childrenOf.get(parentKey) ?? []
      if (options.length === 0) break
      const selectedId = path[idx]?.id ?? ""
      slots.push({ idx, level: options[0].level, options, selectedId })
      if (!selectedId) break
      parentKey = selectedId
      idx++
    }
  }

  // Clearing a level falls back to its parent as the tagged node.
  function selectAt(idx: number, id: string) {
    onChange(id || (path[idx - 1]?.id ?? ""))
  }

  const cls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"

  return (
    <div className="space-y-2">
      {/* Search any node */}
      <div className="relative">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search any topic by code or title…" className={cls} />
        {results.length > 0 && (
          <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {results.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { onChange(t.id); setQuery("") }}
                className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="shrink-0 font-mono text-[11px] text-slate-400">{t.code}</span>
                <span className="truncate text-sm text-slate-600 dark:text-slate-300">{t.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cascading drill-down */}
      {slots.map((slot) => (
        <select key={slot.idx} value={slot.selectedId} onChange={(e) => selectAt(slot.idx, e.target.value)} className={cls}>
          <option value="">Select {levelLabel(slot.level)}…</option>
          {slot.options.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.title}</option>)}
        </select>
      ))}

      {/* Tagged breadcrumb */}
      {path.length > 0 && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Tagged <span className="font-mono">{path[path.length - 1].code}</span> · {path.map((p) => p.title).join(" › ")}
        </p>
      )}
    </div>
  )
}
