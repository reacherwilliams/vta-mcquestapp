"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { signIn } from "next-auth/react"
import { cn } from "@/lib/utils"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Default lands on /home, which routes admins → /admin and everyone else →
  // /practice. An explicit callbackUrl (deep link) is still honoured.
  const callbackUrl = searchParams.get("callbackUrl") ?? "/home"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  function validate() {
    if (!email.includes("@")) return "Enter a valid email address."
    if (password.length < 6) return "Password must be at least 6 characters."
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true)
    const result = await signIn("credentials", { email, password, redirect: false })
    if (result?.error) {
      setError("Incorrect email or password.")
      setLoading(false)
    } else {
      router.push(callbackUrl)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}

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

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Password
          </label>
          <Link href="/forgot-password" className="text-xs font-medium text-lime-700 hover:text-lime-900 dark:text-lime-400 dark:hover:text-lime-200">
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-lime-500 focus:ring-2 focus:ring-lime-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-600"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl border-b-4 border-lime-700 bg-lime-500 py-4 text-base font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2 disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <div className="relative flex items-center gap-3 py-1">
        <div className="flex-1 border-t border-slate-200 dark:border-slate-800" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">or</span>
        <div className="flex-1 border-t border-slate-200 dark:border-slate-800" />
      </div>

      <button
        type="button"
        onClick={() => signIn("google", { redirectTo: callbackUrl })}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {/* Google logo */}
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </button>
    </form>
  )
}

export default function LoginPage() {
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
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Sign in to continue your streak.
            </p>
          </div>

          <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />}>
            <LoginForm />
          </Suspense>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            Don&rsquo;t have an account?{" "}
            <Link href="/register" className="font-semibold text-lime-700 hover:text-lime-900 dark:text-lime-400 dark:hover:text-lime-200">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
