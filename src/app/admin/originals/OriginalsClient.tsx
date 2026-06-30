"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

type Item = {
  id: string
  syllabusCode: string
  subjectName: string
  level: string
  session: string
  year: number
  paper: number
  variant: number
  questionNumber: number
  tier: string | null
  answer: string
  citation: string
}
type Coverage = { syllabusCode: string; subjectName: string; level: string; count: number }
type Props = { items: Item[]; coverage: Coverage[]; total: number }

type Revealed = { id: string; citation: string; answer: string; stem: string; options: { label: string; text: string }[] }

export function OriginalsClient({ items, coverage, total }: Props) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [revealed, setRevealed] = useState<Revealed | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function reveal(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/originals/${id}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "manual review" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { alert(data.error ?? "Reveal failed."); return }
      setRevealed(data)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Original Question Bank</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Real past-paper questions, stored for similarity checking only.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="shrink-0 rounded-xl border-b-4 border-lime-700 bg-lime-500 px-4 py-2 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2"
        >
          {showAdd ? "Close" : "+ Add original"}
        </button>
      </div>

      {/* Security banner */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
        🔒 Question text is <strong>encrypted at rest</strong> and never bulk-readable. Use <strong>Reveal</strong> only to
        adjudicate a specific match — every reveal is <strong>logged to the audit trail</strong>. This bank is Super-Admin only.
      </div>

      {/* Coverage */}
      {coverage.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {coverage.map((c) => (
            <div key={c.syllabusCode} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{c.syllabusCode} · {c.subjectName}</p>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">{c.count}</p>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddForm onDone={() => { setShowAdd(false); router.refresh() }} />}

      {/* List (citations only) */}
      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400 dark:border-slate-700">
          No originals yet. Add some manually, or wait for the bulk ingestion pipeline (Slice 2).
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-800 dark:bg-slate-900/60">
                <th className="px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-400">Citation</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-400">Subject</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-400">Ans</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700 dark:text-slate-300">{it.citation}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{it.level} {it.subjectName}{it.tier ? ` · ${it.tier}` : ""}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-300">{it.answer}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      disabled={busyId === it.id}
                      onClick={() => reveal(it.id)}
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-rose-400 hover:text-rose-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                    >
                      {busyId === it.id ? "…" : "Reveal"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reveal modal */}
      {revealed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-6" onClick={() => setRevealed(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs text-slate-500">{revealed.citation}</h3>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">Reveal logged</span>
            </div>
            <p className="mt-3 text-sm text-slate-900 dark:text-slate-100">{revealed.stem}</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {revealed.options.map((o) => (
                <li key={o.label} className={cn("flex gap-2", o.label === revealed.answer ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-slate-600 dark:text-slate-400")}>
                  <span className="font-mono">{o.label}.</span><span>{o.text}</span>
                  {o.label === revealed.answer && <span className="text-[11px]">✓ answer</span>}
                </li>
              ))}
            </ul>
            <div className="mt-4 text-right">
              <button onClick={() => setRevealed(null)} className="rounded-full bg-slate-800 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-700">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AddForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({
    syllabusCode: "", subjectName: "", level: "IGCSE", session: "MJ", year: new Date().getFullYear() - 1,
    paper: 1, variant: 1, questionNumber: 1, tier: "", answer: "A", citation: "",
    stem: "", a: "", b: "", c: "", d: "",
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) { setF((p) => ({ ...p, [k]: v })) }

  async function submit() {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch("/api/admin/originals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          syllabusCode: f.syllabusCode.trim(), subjectName: f.subjectName.trim(), level: f.level,
          session: f.session, year: Number(f.year), paper: Number(f.paper), variant: Number(f.variant),
          questionNumber: Number(f.questionNumber), tier: f.tier || null, answer: f.answer,
          citation: f.citation.trim(),
          stem: f.stem.trim(),
          options: [{ label: "A", text: f.a }, { label: "B", text: f.b }, { label: "C", text: f.c }, { label: "D", text: f.d }],
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? "Save failed."); return }
      onDone()
    } finally { setBusy(false) }
  }

  const inp = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">{error}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <input className={inp} placeholder="Syllabus code (0625)" value={f.syllabusCode} onChange={(e) => set("syllabusCode", e.target.value)} />
        <input className={inp} placeholder="Subject (Physics)" value={f.subjectName} onChange={(e) => set("subjectName", e.target.value)} />
        <select className={inp} value={f.level} onChange={(e) => set("level", e.target.value)}>
          <option value="IGCSE">IGCSE</option>
          <option value="AS_A_LEVEL">AS &amp; A Level</option>
        </select>
        <select className={inp} value={f.session} onChange={(e) => set("session", e.target.value)}>
          <option value="FM">Feb/March</option>
          <option value="MJ">May/June</option>
          <option value="ON">Oct/Nov</option>
        </select>
        <input className={inp} type="number" placeholder="Year" value={f.year} onChange={(e) => set("year", Number(e.target.value))} />
        <input className={inp} type="number" placeholder="Paper" value={f.paper} onChange={(e) => set("paper", Number(e.target.value))} />
        <input className={inp} type="number" placeholder="Variant" value={f.variant} onChange={(e) => set("variant", Number(e.target.value))} />
        <input className={inp} type="number" placeholder="Q #" value={f.questionNumber} onChange={(e) => set("questionNumber", Number(e.target.value))} />
        <select className={inp} value={f.tier} onChange={(e) => set("tier", e.target.value)}>
          <option value="">No tier</option>
          <option value="CORE">Core</option>
          <option value="EXTENDED">Extended</option>
        </select>
        <select className={inp} value={f.answer} onChange={(e) => set("answer", e.target.value)}>
          {["A", "B", "C", "D"].map((x) => <option key={x} value={x}>Answer {x}</option>)}
        </select>
        <input className={cn(inp, "col-span-2")} placeholder="Citation (0625/12 M/J 2021 Q14)" value={f.citation} onChange={(e) => set("citation", e.target.value)} />
      </div>
      <textarea className={inp} rows={2} placeholder="Question stem" value={f.stem} onChange={(e) => set("stem", e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <input className={inp} placeholder="Option A" value={f.a} onChange={(e) => set("a", e.target.value)} />
        <input className={inp} placeholder="Option B" value={f.b} onChange={(e) => set("b", e.target.value)} />
        <input className={inp} placeholder="Option C" value={f.c} onChange={(e) => set("c", e.target.value)} />
        <input className={inp} placeholder="Option D" value={f.d} onChange={(e) => set("d", e.target.value)} />
      </div>
      <div className="text-right">
        <button disabled={busy} onClick={submit} className="rounded-full bg-lime-500 px-5 py-2 text-xs font-bold uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 disabled:opacity-50">
          {busy ? "Encrypting…" : "Encrypt & save"}
        </button>
      </div>
    </div>
  )
}
