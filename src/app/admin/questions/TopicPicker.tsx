"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"

export type Topic = { id: string; parentId: string | null; code: string; title: string; level: number }

// Searchable combobox for the deep syllabus Topic tree (filter by code or title).
export function TopicPicker({ topics, value, onChange }: { topics: Topic[]; value: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const selected = topics.find((t) => t.id === value) ?? null

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? topics.filter((t) => t.code.toLowerCase().includes(q) || t.title.toLowerCase().includes(q))
      : topics
    return list.slice(0, 60)
  }, [topics, query])

  // Compact chip when a topic is chosen and we're not actively searching.
  if (selected && !open) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
        <span className="shrink-0 font-mono text-[11px] text-slate-500">{selected.code}</span>
        <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-300">{selected.title}</span>
        <button type="button" onClick={() => { setQuery(""); setOpen(true) }} className="shrink-0 text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">change</button>
        <button type="button" onClick={() => onChange("")} aria-label="Clear topic" className="shrink-0 text-slate-400 hover:text-rose-500">✕</button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        autoFocus={open}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search topic by code or title…"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
      />
      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">No topics match.</p>
          ) : results.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { onChange(t.id); setQuery(""); setOpen(false) }}
              className="flex w-full items-baseline gap-2 py-1.5 pr-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
              style={{ paddingLeft: `${0.75 + (t.level - 1) * 0.85}rem` }}
            >
              <span className="shrink-0 font-mono text-[11px] text-slate-400">{t.code}</span>
              <span className={cn("truncate text-sm", t.level === 1 ? "font-semibold text-slate-800 dark:text-slate-200" : "text-slate-600 dark:text-slate-400")}>{t.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
