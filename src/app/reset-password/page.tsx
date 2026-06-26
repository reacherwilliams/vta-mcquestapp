"use client"

import Link from "next/link"
import { useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"

function ResetPasswordInner() {
  const router = useRouter()
  const token = useSearchParams().get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError("Password must be at least 8 characters."); return }
    if (password !== confirm) { setError("Passwords don't match."); return }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? "Something went wrong. Please try again."); return }
      setDone(true)
      setTimeout(() => router.push("/login"), 1800)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <div className="h-1 bg-linear-to-r from-orange-500 via-amber-500 to-lime-500" />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <Link href="/" className="inline-block">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                MCQ<span className="text-lime-600"> MasterLoop</span>
              </span>
            </Link>
            <h1 className="mt-3 text-xl font-extrabold text-slate-900 dark:text-slate-100">
              {done ? "Password updated" : "Choose a new password"}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {done ? "Redirecting you to sign in…" : "Enter a new password for your account."}
            </p>
          </div>

          {!token && !done ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-400">
              This reset link is missing its token. Please request a new one from{" "}
              <Link href="/forgot-password" className="font-semibold underline">forgot password</Link>.
            </p>
          ) : !done ? (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-400">{error}</p>
              )}
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">New password</label>
                <input
                  id="password" type="password" autoComplete="new-password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-lime-500 focus:ring-2 focus:ring-lime-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirm" className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Confirm password</label>
                <input
                  id="confirm" type="password" autoComplete="new-password" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-lime-500 focus:ring-2 focus:ring-lime-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Re-enter your new password"
                />
              </div>
              <button
                type="submit" disabled={loading}
                className="w-full rounded-2xl border-b-4 border-lime-700 bg-lime-500 py-4 text-base font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2 disabled:opacity-60"
              >
                {loading ? "Updating…" : "Update password"}
              </button>
            </form>
          ) : (
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-lime-100 dark:bg-lime-950/40">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-lime-600 dark:text-lime-400">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
          )}

          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            <Link href="/login" className="font-semibold text-lime-700 hover:text-lime-900 dark:text-lime-400 dark:hover:text-lime-200">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  )
}
