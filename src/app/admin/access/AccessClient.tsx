"use client"

import { useState, type FormEvent } from "react"
import { cn } from "@/lib/utils"

type Gate = { enabled: boolean; enforceFrom: string | null }

type Enrollment = {
  id: string
  subjectId: string
  status: string
  source: string
  startedAt: string
  expiresAt: string | null
  subject: { name: string; syllabusCode: string | null; code: string; curriculum: { code: string } }
}
type CatalogueSubject = {
  id: string
  name: string
  syllabusCode: string | null
  code: string
  curriculum: { code: string; displayName: string }
}
type Lookup = {
  user: { id: string; email: string; firstName: string; lastName: string; role: string; createdAt: string }
  enrollments: Enrollment[]
  subjects: CatalogueSubject[]
}

const SOURCES = ["TRIAL", "PAID", "COMP"] as const

export function AccessClient({ initialGate, initialTrialDays }: { initialGate: Gate; initialTrialDays: number }) {
  // ── Gate ──────────────────────────────────────────────────────────────────
  const [gate, setGate] = useState<Gate>(initialGate)
  const [savingGate, setSavingGate] = useState(false)
  const [gateMsg, setGateMsg] = useState<string | null>(null)

  // ── Trial length ────────────────────────────────────────────────────────────
  const [trialDays, setTrialDays] = useState<number>(initialTrialDays)
  const [savingTrial, setSavingTrial] = useState(false)
  const [trialMsg, setTrialMsg] = useState<string | null>(null)

  async function saveTrial() {
    setSavingTrial(true)
    setTrialMsg(null)
    try {
      const res = await fetch("/api/admin/access/trial", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: trialDays }),
      })
      const data = await res.json()
      if (!res.ok) { setTrialMsg(data.error ?? "Failed to save."); return }
      setTrialDays(data.days)
      setTrialMsg("Saved.")
    } finally { setSavingTrial(false) }
  }

  async function saveGate(next: Gate) {
    setSavingGate(true)
    setGateMsg(null)
    try {
      const res = await fetch("/api/admin/access/gate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      })
      const data = await res.json()
      if (!res.ok) { setGateMsg(data.error ?? "Failed to save."); return }
      setGate(data)
      setGateMsg("Saved.")
    } finally { setSavingGate(false) }
  }

  // ── Student lookup ──────────────────────────────────────────────────────────
  const [email, setEmail] = useState("")
  const [lookup, setLookup] = useState<Lookup | null>(null)
  const [loading, setLoading] = useState(false)
  const [lookupErr, setLookupErr] = useState<string | null>(null)

  async function runLookup(e?: FormEvent) {
    e?.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setLookupErr(null)
    try {
      const res = await fetch(`/api/admin/access/enrollments?email=${encodeURIComponent(email.trim())}`)
      const data = await res.json()
      if (!res.ok) { setLookup(null); setLookupErr(data.error ?? "Lookup failed."); return }
      setLookup(data)
      setSelected(new Set())
    } finally { setLoading(false) }
  }

  // ── Grant form ──────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [source, setSource] = useState<(typeof SOURCES)[number]>("COMP")
  const [expiresAt, setExpiresAt] = useState("")
  const [granting, setGranting] = useState(false)

  const enrolledIds = new Set(lookup?.enrollments.map((e) => e.subjectId))

  function toggleSubject(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function grant() {
    if (!lookup || selected.size === 0) return
    setGranting(true)
    try {
      const res = await fetch("/api/admin/access/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: lookup.user.id,
          subjectIds: [...selected],
          source,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      })
      if (res.ok) { setSelected(new Set()); setExpiresAt(""); await runLookup() }
    } finally { setGranting(false) }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/admin/access/enrollments/${id}`, { method: "DELETE" })
    if (res.ok) await runLookup()
  }

  // Group catalogue subjects by curriculum for the picker.
  const byCurriculum = (lookup?.subjects ?? []).reduce<Record<string, CatalogueSubject[]>>((acc, s) => {
    const key = s.curriculum.displayName
    ;(acc[key] ??= []).push(s)
    return acc
  }, {})

  return (
    <div className="space-y-8">
      {/* ── Master gate ──────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Entitlement gate</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {gate.enabled
                ? "ON — students are restricted to their enrolled subjects."
                : "OFF — every signed-in student has full access (current behaviour)."}
            </p>
          </div>
          <button
            type="button"
            disabled={savingGate}
            onClick={() => saveGate({
              enabled: !gate.enabled,
              // Default to grandfathering existing accounts when first enabling.
              enforceFrom: !gate.enabled && !gate.enforceFrom ? new Date().toISOString() : gate.enforceFrom,
            })}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50",
              gate.enabled ? "bg-lime-500" : "bg-slate-300 dark:bg-slate-700",
            )}
            aria-pressed={gate.enabled}
            aria-label="Toggle entitlement gate"
          >
            <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white transition-all", gate.enabled ? "left-6" : "left-1")} />
          </button>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Grandfather cutoff</p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Accounts created before this keep full access, so enabling the gate never locks out existing students.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {gate.enforceFrom ? new Date(gate.enforceFrom).toLocaleString() : "none — everyone gated"}
            </span>
            <button onClick={() => saveGate({ ...gate, enforceFrom: new Date().toISOString() })} disabled={savingGate}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              Set to now
            </button>
            {gate.enforceFrom && (
              <button onClick={() => saveGate({ ...gate, enforceFrom: null })} disabled={savingGate}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-rose-950/30">
                Clear
              </button>
            )}
          </div>
        </div>
        {gateMsg && <p className="mt-3 text-xs text-slate-400">{gateMsg}</p>}
      </section>

      {/* ── Free trial length ────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Free trial length</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          New students get a trial of this length for the subjects they pick at signup.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={365}
            value={trialDays}
            onChange={(e) => setTrialDays(Number(e.target.value))}
            className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          />
          <span className="text-sm text-slate-500">days</span>
          <button onClick={saveTrial} disabled={savingTrial || trialDays < 1}
            className="ml-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-700">
            {savingTrial ? "Saving…" : "Save"}
          </button>
          {trialMsg && <span className="text-xs text-slate-400">{trialMsg}</span>}
        </div>
      </section>

      {/* ── Per-student enrollments ──────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Student enrollments</h2>
        <form onSubmit={runLookup} className="mt-3 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@email.com"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          />
          <button type="submit" disabled={loading || !email.trim()}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-700">
            {loading ? "Loading…" : "Look up"}
          </button>
        </form>
        {lookupErr && <p className="mt-2 text-xs text-rose-500">{lookupErr}</p>}

        {lookup && (
          <div className="mt-5 space-y-5">
            <div className="text-sm">
              <span className="font-semibold text-slate-800 dark:text-slate-100">{lookup.user.firstName} {lookup.user.lastName}</span>
              <span className="ml-2 text-slate-400">{lookup.user.email}</span>
              <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">{lookup.user.role}</span>
            </div>

            {/* Current enrollments */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Current access ({lookup.enrollments.length})</p>
              {lookup.enrollments.length === 0 ? (
                <p className="text-xs text-slate-400">No enrollments — this student has no gated access.</p>
              ) : (
                <ul className="space-y-1.5">
                  {lookup.enrollments.map((en) => {
                    const expired = en.expiresAt && new Date(en.expiresAt) < new Date()
                    return (
                      <li key={en.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-800">
                        <span className="font-medium text-slate-700 dark:text-slate-200">{en.subject.name}</span>
                        <span className="font-mono text-[11px] text-slate-400">{en.subject.curriculum.code} · {en.subject.syllabusCode ?? en.subject.code}</span>
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                          en.source === "PAID" ? "bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400"
                          : en.source === "TRIAL" ? "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400")}>
                          {en.source}
                        </span>
                        <span className={cn("text-[11px]", expired ? "text-rose-500" : "text-slate-400")}>
                          {en.expiresAt ? `${expired ? "expired" : "expires"} ${new Date(en.expiresAt).toLocaleDateString()}` : "no expiry"}
                        </span>
                        <button onClick={() => revoke(en.id)} className="ml-auto text-xs font-semibold text-rose-500 hover:underline">revoke</button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Grant new */}
            <div className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Grant subjects</p>
              <div className="max-h-60 space-y-3 overflow-y-auto pr-1">
                {Object.entries(byCurriculum).map(([curr, subs]) => (
                  <div key={curr}>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{curr}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {subs.map((s) => {
                        const already = enrolledIds.has(s.id)
                        const on = selected.has(s.id)
                        return (
                          <button
                            key={s.id}
                            type="button"
                            disabled={already}
                            onClick={() => toggleSubject(s.id)}
                            title={already ? "Already enrolled" : undefined}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                              already ? "cursor-not-allowed border-slate-100 text-slate-300 dark:border-slate-800 dark:text-slate-600"
                              : on ? "border-lime-400 bg-lime-50 text-lime-700 dark:border-lime-700 dark:bg-lime-950/30 dark:text-lime-400"
                              : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300",
                            )}
                          >
                            {s.name} · {s.syllabusCode ?? s.code}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <label className="text-xs text-slate-500">
                  <span className="mb-1 block font-semibold">Source</span>
                  <select value={source} onChange={(e) => setSource(e.target.value as (typeof SOURCES)[number])}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-500">
                  <span className="mb-1 block font-semibold">Expires (optional)</span>
                  <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" />
                </label>
                <button onClick={grant} disabled={granting || selected.size === 0}
                  className="ml-auto rounded-lg bg-lime-500 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-lime-400 disabled:opacity-50">
                  {granting ? "Granting…" : `Grant ${selected.size || ""}`.trim()}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
