"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { computeSubjectPrice, formatMoney, type PricingConfig } from "@/lib/pricing"

type Subject = { id: string; name: string; code: string; curriculum: string }

export function SubscribeClient({
  subjects,
  enrollmentMap,
  pricing,
}: {
  subjects: Subject[]
  enrollmentMap: Record<string, string> // subjectId -> source (PAID/TRIAL/COMP)
  pricing: PricingConfig
}) {
  // Pre-select trial subjects (the natural conversion). Paid ones are locked on.
  const paidIds = useMemo(() => new Set(Object.entries(enrollmentMap).filter(([, s]) => s === "PAID").map(([id]) => id)), [enrollmentMap])
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(Object.entries(enrollmentMap).filter(([, s]) => s === "TRIAL").map(([id]) => id)),
  )
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    if (paidIds.has(id)) return // already owned
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const qty = selected.size
  const quote = computeSubjectPrice(pricing, Math.max(1, qty), interval)
  const monthlyQuote = computeSubjectPrice(pricing, Math.max(1, qty), "monthly")
  // Per-subject rate at qty=1 (no volume discount) — to show the saving.
  const baseQuote = computeSubjectPrice(pricing, 1, interval)
  const saving = (baseQuote.perSubjectCents - quote.perSubjectCents) * qty

  const byCurriculum = useMemo(() => {
    return subjects.reduce<Record<string, Subject[]>>((acc, s) => {
      ;(acc[s.curriculum] ??= []).push(s)
      return acc
    }, {})
  }, [subjects])

  async function checkout() {
    if (qty === 0) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/billing/checkout/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectIds: [...selected], interval }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) { setError(data.error ?? "Could not start checkout."); setLoading(false); return }
      window.location.href = data.url
    } catch {
      setError("Network error. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <header className="border-b border-slate-100 dark:border-slate-900">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-4 px-6 py-3 sm:px-10">
          <Link href="/practice" aria-label="Back" className="text-2xl font-light text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">×</Link>
          <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Choose your subjects</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-6 pb-44 sm:px-10">
        {/* Interval toggle */}
        <div className="mb-5 inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
          {(["monthly", "yearly"] as const).map((iv) => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition",
                interval === iv ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100" : "text-slate-500",
              )}
            >
              {iv}{iv === "yearly" && pricing.yearlyMonths < 12 ? ` · ${12 - pricing.yearlyMonths}mo free` : ""}
            </button>
          ))}
        </div>

        {/* Subject picker */}
        <div className="space-y-5">
          {Object.entries(byCurriculum).map(([curr, subs]) => (
            <section key={curr}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">{curr}</p>
              <div className="flex flex-wrap gap-2">
                {subs.map((s) => {
                  const owned = paidIds.has(s.id)
                  const on = selected.has(s.id)
                  const isTrial = enrollmentMap[s.id] === "TRIAL"
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggle(s.id)}
                      disabled={owned}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                        owned ? "cursor-default border-lime-300 bg-lime-50 text-lime-700 dark:border-lime-800 dark:bg-lime-950/30 dark:text-lime-400"
                        : on ? "border-lime-400 bg-lime-50 text-lime-700 dark:border-lime-700 dark:bg-lime-950/30 dark:text-lime-400"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300",
                      )}
                    >
                      {s.name} <span className="font-mono text-[11px] opacity-60">{s.code}</span>
                      {owned && <span className="text-[10px] font-bold uppercase">· owned</span>}
                      {!owned && isTrial && <span className="text-[10px] font-bold uppercase opacity-70">· trial</span>}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </main>

      {/* Sticky checkout summary */}
      <footer className="fixed inset-x-0 bottom-0 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-900 dark:bg-slate-950/95 sm:px-10">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {qty === 0 ? "Pick at least one subject" : (
                <>
                  {formatMoney(quote.totalCents, quote.currency)}
                  <span className="text-xs font-normal text-slate-500"> / {interval === "yearly" ? "year" : "month"}</span>
                </>
              )}
            </p>
            {qty > 0 && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {qty} {qty === 1 ? "subject" : "subjects"} · {formatMoney(monthlyQuote.perSubjectCents, quote.currency)}/subject/mo
                {saving > 0 && <span className="ml-1 font-semibold text-lime-600 dark:text-lime-400">· save {formatMoney(saving, quote.currency)}</span>}
              </p>
            )}
            {error && <p className="text-[11px] text-rose-500">{error}</p>}
          </div>
          <button
            onClick={checkout}
            disabled={loading || qty === 0}
            className="shrink-0 rounded-xl border-b-4 border-lime-700 bg-lime-500 px-6 py-3 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2 disabled:opacity-50"
          >
            {loading ? "Starting…" : "Subscribe →"}
          </button>
        </div>
      </footer>
    </div>
  )
}
