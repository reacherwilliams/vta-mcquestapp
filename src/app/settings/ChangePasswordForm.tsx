"use client"

import { useState } from "react"

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)
    if (next.length < 8) { setError("New password must be at least 8 characters."); return }
    if (next !== confirm) { setError("New passwords don't match."); return }
    setLoading(true)
    try {
      const res = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? "Something went wrong. Please try again."); return }
      setDone(true)
      setCurrent(""); setNext(""); setConfirm("")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-lime-500 focus:ring-2 focus:ring-lime-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
  const labelCls = "block text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400"

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-400">{error}</p>
      )}
      {done && (
        <p className="rounded-xl border border-lime-300 bg-lime-50 px-4 py-3 text-sm text-lime-800 dark:border-lime-800/40 dark:bg-lime-950/20 dark:text-lime-300">
          Password updated. Use your new password next time you sign in.
        </p>
      )}
      <div className="space-y-1.5">
        <label htmlFor="current" className={labelCls}>Current password</label>
        <input id="current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} placeholder="Your current password" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="next" className={labelCls}>New password</label>
        <input id="next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} placeholder="At least 8 characters" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm" className={labelCls}>Confirm new password</label>
        <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} placeholder="Re-enter your new password" />
      </div>
      <button
        type="submit" disabled={loading}
        className="w-full rounded-2xl border-b-4 border-lime-700 bg-lime-500 py-3.5 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2 disabled:opacity-60"
      >
        {loading ? "Updating…" : "Change password"}
      </button>
    </form>
  )
}
