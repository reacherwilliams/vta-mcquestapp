"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { formatMoney } from "@/lib/pricing"

type ExpenseItem = {
  id: string
  category: string
  amountCents: number
  currency: string
  incurredOn: string
  note: string | null
  recordedBy: string | null
}
type Range = { key: string; label: string; prevKey: string; nextKey: string; isCurrent: boolean; isFuture: boolean }
type Beneficiary = { label: string; pct: number; email: string | null }
type Distribution = { distributableCents: number; totalPct: number; shares: { label: string; pct: number; email: string | null; cents: number }[] }

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  CONTRIBUTOR_PAYOUT: { label: "Contributor payouts", color: "bg-teal-500" },
  PLATFORM:           { label: "Platform / infra",     color: "bg-sky-500" },
  SALARY:             { label: "Salaries",             color: "bg-amber-500" },
  MARKETING:          { label: "Marketing",            color: "bg-orange-500" },
  TAX:                { label: "Tax",                  color: "bg-rose-500" },
  REFUND:             { label: "Refunds",              color: "bg-pink-500" },
  OTHER:              { label: "Other",                color: "bg-slate-400" },
}
const EDITABLE_CATEGORIES = ["PLATFORM", "SALARY", "MARKETING", "TAX", "REFUND", "OTHER"] as const

export function FinanceClient({
  canManage, range, currency, incomeCents, incomeIsProjected, actualAvailable, expenses, netCents, profitShare, distribution,
}: {
  canManage: boolean
  range: Range
  currency: string
  incomeCents: number
  incomeIsProjected: boolean
  actualAvailable: boolean
  expenses: { totalCents: number; payoutCents: number; byCategory: { category: string; cents: number }[]; items: ExpenseItem[] }
  netCents: number
  profitShare: { beneficiaries: Beneficiary[] }
  distribution: Distribution
}) {
  const router = useRouter()
  const [form, setForm] = useState({ category: "PLATFORM", amount: "", incurredOn: `${range.key}-15`, note: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function addExpense() {
    const amountCents = Math.round(Number(form.amount) * 100)
    if (!Number.isFinite(amountCents) || amountCents <= 0) { setError("Enter a valid amount."); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/admin/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: form.category, amountCents, currency, incurredOn: form.incurredOn, note: form.note }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to save."); return }
      setForm((f) => ({ ...f, amount: "", note: "" }))
      router.refresh()
    } finally { setSaving(false) }
  }

  async function del(id: string) {
    const res = await fetch(`/api/admin/finance/expenses/${id}`, { method: "DELETE" })
    if (res.ok) router.refresh()
  }

  // ── Profit-share editor (SA) ────────────────────────────────────────────────
  const [editSplit, setEditSplit] = useState(false)
  const [bens, setBens] = useState<Beneficiary[]>(profitShare.beneficiaries)
  const [savingSplit, setSavingSplit] = useState(false)
  const [splitError, setSplitError] = useState<string | null>(null)
  const editedTotal = bens.reduce((s, b) => s + (Number(b.pct) || 0), 0)

  function setBen(i: number, patch: Partial<Beneficiary>) {
    setBens((p) => p.map((b, idx) => (idx === i ? { ...b, ...patch } : b)))
  }
  async function saveSplit() {
    setSavingSplit(true); setSplitError(null)
    try {
      const res = await fetch("/api/admin/finance/profit-share", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beneficiaries: bens.map((b) => ({ ...b, pct: Number(b.pct) })) }),
      })
      const data = await res.json()
      if (!res.ok) { setSplitError(data.error ?? "Failed to save."); return }
      setEditSplit(false); router.refresh()
    } finally { setSavingSplit(false) }
  }

  const maxCat = Math.max(1, ...expenses.byCategory.map((c) => c.cents))
  const incomeLabel = incomeIsProjected ? (range.isCurrent ? "Projected income" : "Income") : "Income"

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      {/* Header + month nav */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">Finance</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Monthly income, expenses and net.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/finance?month=${range.prevKey}`} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">←</Link>
          <span className="min-w-36 text-center text-sm font-bold text-slate-800 dark:text-slate-100">{range.label}</span>
          <Link
            href={`/admin/finance?month=${range.nextKey}`}
            aria-disabled={range.isCurrent}
            tabIndex={range.isCurrent ? -1 : undefined}
            className={cn("rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300",
              range.isCurrent ? "pointer-events-none opacity-40" : "hover:bg-slate-50 dark:hover:bg-slate-800")}
          >→</Link>
        </div>
      </header>

      {/* P&L summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{incomeLabel}</p>
          <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatMoney(incomeCents, currency)}</p>
          {incomeIsProjected && (
            <p className="mt-0.5 text-[10px] text-slate-400">{range.isCurrent ? "estimate — billing not live" : "no Stripe data"}</p>
          )}
          {actualAvailable && <p className="mt-0.5 text-[10px] text-slate-400">actual · Stripe</p>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Expenses</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">{formatMoney(expenses.totalCents, currency)}</p>
          {expenses.payoutCents > 0 && <p className="mt-0.5 text-[10px] text-slate-400">incl. {formatMoney(expenses.payoutCents, currency)} payouts</p>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Net</p>
          <p className={cn("mt-1 text-2xl font-black", netCents >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
            {netCents < 0 ? "−" : ""}{formatMoney(Math.abs(netCents), currency)}
          </p>
        </div>
      </div>

      {/* Profit distribution */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Profit distribution</h2>
          {canManage && !editSplit && (
            <button onClick={() => { setBens(profitShare.beneficiaries); setEditSplit(true) }} className="text-xs font-semibold text-lime-700 hover:underline dark:text-lime-400">Edit split</button>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {distribution.distributableCents > 0
            ? <>Splitting <span className="font-semibold">{formatMoney(distribution.distributableCents, currency)}</span> net profit for {range.label}.</>
            : <>No profit to distribute for {range.label}{netCents < 0 ? " (net loss)." : "."}</>}
        </p>

        {!editSplit ? (
          <div className="mt-3 space-y-2">
            {distribution.shares.map((s) => (
              <div key={s.label} className="flex items-center gap-3 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">{s.label}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{s.pct}%</span>
                <span className="ml-auto font-bold text-slate-900 dark:text-slate-100">{formatMoney(s.cents, currency)}</span>
              </div>
            ))}
            {distribution.totalPct !== 100 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">⚠ Percentages total {distribution.totalPct}%, not 100%.</p>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {bens.map((b, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <input value={b.label} onChange={(e) => setBen(i, { label: e.target.value })} placeholder="Name"
                  className="w-40 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" />
                <input type="number" min={0} max={100} step="0.5" value={b.pct} onChange={(e) => setBen(i, { pct: Number(e.target.value) })}
                  className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" />
                <span className="text-slate-400">%</span>
                <input value={b.email ?? ""} onChange={(e) => setBen(i, { email: e.target.value || null })} placeholder="email (optional — for personal share)"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" />
                <button onClick={() => setBens((p) => p.filter((_, idx) => idx !== i))} className="text-xs text-rose-500 hover:underline">remove</button>
              </div>
            ))}
            <div className="flex items-center gap-3 pt-1">
              <button onClick={() => setBens((p) => [...p, { label: "", pct: 0, email: null }])} className="rounded-lg border border-dashed border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:border-slate-400 dark:border-slate-600">+ Add</button>
              <span className={cn("text-xs font-semibold", editedTotal === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>Total {editedTotal}%</span>
              <button onClick={saveSplit} disabled={savingSplit} className="ml-auto rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-700">{savingSplit ? "Saving…" : "Save"}</button>
              <button onClick={() => setEditSplit(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancel</button>
            </div>
            {splitError && <p className="text-xs text-rose-500">{splitError}</p>}
          </div>
        )}
      </section>

      {/* Expense breakdown */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Expense breakdown</h2>
        {expenses.byCategory.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No expenses recorded for {range.label}.</p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {expenses.byCategory.map((c) => {
              const meta = CATEGORY_META[c.category] ?? CATEGORY_META.OTHER
              return (
                <div key={c.category}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{meta.label}</span>
                    <span className="text-slate-500">{formatMoney(c.cents, currency)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className={cn("h-full rounded-full", meta.color)} style={{ width: `${Math.round((c.cents / maxCat) * 100)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Add expense — SA only */}
      {canManage && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Record an expense</h2>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-500">
              <span className="mb-1 block font-semibold">Category</span>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {EDITABLE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              <span className="mb-1 block font-semibold">Amount ({currency.toUpperCase()})</span>
              <input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00" className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" />
            </label>
            <label className="text-xs text-slate-500">
              <span className="mb-1 block font-semibold">Date</span>
              <input type="date" value={form.incurredOn} onChange={(e) => setForm((f) => ({ ...f, incurredOn: e.target.value }))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" />
            </label>
            <label className="flex-1 text-xs text-slate-500">
              <span className="mb-1 block font-semibold">Note (optional)</span>
              <input type="text" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="e.g. Vercel + Supabase" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" />
            </label>
            <button onClick={addExpense} disabled={saving}
              className="rounded-lg bg-lime-500 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-lime-400 disabled:opacity-50">
              {saving ? "Saving…" : "Add"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
        </section>
      )}

      {/* Recorded expenses ledger */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">Recorded expenses</h2>
        {expenses.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400 dark:border-slate-700">Nothing recorded for {range.label}.</p>
        ) : (
          <ul className="space-y-1.5">
            {expenses.items.map((e) => {
              const meta = CATEGORY_META[e.category] ?? CATEGORY_META.OTHER
              return (
                <li key={e.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2 text-sm dark:border-slate-800">
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", meta.color)} />
                  <span className="font-medium text-slate-700 dark:text-slate-200">{meta.label}</span>
                  {e.note && <span className="truncate text-xs text-slate-400">· {e.note}</span>}
                  <span className="ml-auto text-xs text-slate-400">{new Date(e.incurredOn).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMoney(e.amountCents, e.currency)}</span>
                  {canManage && <button onClick={() => del(e.id)} className="text-xs font-semibold text-rose-500 hover:underline">delete</button>}
                </li>
              )
            })}
          </ul>
        )}
        {expenses.payoutCents > 0 && (
          <p className="mt-2 text-[11px] text-slate-400">
            + {formatMoney(expenses.payoutCents, currency)} contributor payouts (from the payout system) are included in totals.
          </p>
        )}
      </section>
    </div>
  )
}
