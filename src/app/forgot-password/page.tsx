"use client"

import Link from "next/link"
import { useState } from "react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.includes("@")) return
    setLoading(true)
    try {
      // Always succeeds from the client's view — the API never reveals whether
      // the email exists (no account enumeration).
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
    } catch {
      // Network error — still show the generic confirmation.
    } finally {
      setLoading(false)
      setSent(true)
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
              {sent ? "Check your inbox" : "Reset your password"}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {sent
                ? `We sent a reset link to ${email}. Check your spam folder if it doesn't arrive.`
                : "Enter your email and we'll send you a reset link."}
            </p>
          </div>

          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-lime-500 focus:ring-2 focus:ring-lime-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-600"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl border-b-4 border-lime-700 bg-lime-500 py-4 text-base font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2 disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          ) : (
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-lime-100 dark:bg-lime-950/40">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-lime-600 dark:text-lime-400">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.26h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.29 6.29l.96-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
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
