"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"

export type CoverageNode = {
  id: string
  parentId: string | null
  code: string
  title: string
  depth: number
  hasChildren: boolean
  live: number       // subtree count of PUBLISHED questions
  pipeline: number   // subtree count of in-review questions
  examWeight: number | null
}

// Tone for a coverage count: red = gap, amber = thin, emerald = covered.
function tone(live: number) {
  if (live === 0) return { dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", label: "gap" }
  if (live < 3) return { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", label: "thin" }
  return { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", label: "" }
}

export function CoverageTree({ nodes }: { nodes: CoverageNode[] }) {
  // Default: top level expanded, deeper branches collapsed (deep trees get busy).
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(nodes.filter((n) => n.hasChildren && n.depth >= 1).map((n) => n.id)),
  )

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allBranchIds = useMemo(() => nodes.filter((n) => n.hasChildren).map((n) => n.id), [nodes])
  const expandAll = () => setCollapsed(new Set())
  const collapseAll = () => setCollapsed(new Set(allBranchIds))

  // Flatten with collapse: skip nodes deeper than a collapsed ancestor.
  const visible = useMemo(() => {
    const out: CoverageNode[] = []
    let collapseDepth = Infinity
    for (const n of nodes) {
      if (n.depth > collapseDepth) continue
      collapseDepth = Infinity
      out.push(n)
      if (n.hasChildren && collapsed.has(n.id)) collapseDepth = n.depth
    }
    return out
  }, [nodes, collapsed])

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 dark:border-slate-800">
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> gap</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> thin (&lt;3)</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> covered</span>
        </div>
        <div className="flex gap-2 text-[11px] font-semibold text-slate-500">
          <button onClick={expandAll} className="hover:text-slate-800 dark:hover:text-slate-200">Expand all</button>
          <span className="text-slate-300">·</span>
          <button onClick={collapseAll} className="hover:text-slate-800 dark:hover:text-slate-200">Collapse all</button>
        </div>
      </div>

      <ul className="divide-y divide-slate-50 dark:divide-slate-800/60">
        {visible.map((n) => {
          const t = tone(n.live)
          const isCollapsed = collapsed.has(n.id)
          return (
            <li
              key={n.id}
              className="flex items-center gap-2 px-3 py-2 transition hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
              style={{ paddingLeft: 12 + n.depth * 18 }}
            >
              {/* Disclosure toggle */}
              {n.hasChildren ? (
                <button
                  onClick={() => toggle(n.id)}
                  aria-label={isCollapsed ? "Expand" : "Collapse"}
                  className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={cn("h-3 w-3 transition-transform", isCollapsed ? "" : "rotate-90")}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ) : (
                <span className={cn("h-2 w-2 shrink-0 rounded-full", t.dot)} />
              )}

              <span className="shrink-0 font-mono text-[11px] text-slate-400">{n.code}</span>
              <span className={cn("truncate text-sm", n.depth === 0 ? "font-semibold text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300")}>
                {n.title}
              </span>
              {n.examWeight != null && (
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {n.examWeight}%
                </span>
              )}

              <span className="ml-auto flex shrink-0 items-center gap-2">
                {n.pipeline > 0 && (
                  <span className="text-[10px] text-slate-400" title="In the review pipeline">+{n.pipeline}</span>
                )}
                <span className={cn("min-w-12 text-right text-xs font-bold tabular-nums", t.text)}>
                  {n.live} live{t.label ? ` · ${t.label}` : ""}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
