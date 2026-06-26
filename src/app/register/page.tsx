"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { signIn } from "next-auth/react"

export default function RegisterPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    dateOfBirth: "",
    terms: false,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form | "submit", string>>>({})
  const [loading, setLoading] = useState(false)

  function set(field: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validate() {
    const e: typeof errors = {}
    if (!form.firstName.trim()) e.firstName = "Required"
    if (!form.lastName.trim()) e.lastName = "Required"
    if (!form.email.includes("@")) e.email = "Enter a valid email address."
    if (form.password.length < 8) e.password = "Password must be at least 8 characters."
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords don't match."
    if (!form.dateOfBirth) e.dateOfBirth = "Required for age verification."
    if (!form.terms) e.terms = "You must accept the terms."
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          dateOfBirth: form.dateOfBirth || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrors({ submit: data.error ?? "Something went wrong." })
        setLoading(false)
        return
      }
      await signIn("credentials", { email: form.email, password: form.password, redirectTo: "/onboarding" })
    } catch {
      setErrors({ submit: "Network error. Please try again." })
      setLoading(false)
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-lime-500 focus:ring-2 focus:ring-lime-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-600"
  const labelClass =
    "block text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400"
  const fieldErrorClass = "mt-1 text-xs text-rose-600 dark:text-rose-400"

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
              Create your account
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Free forever — no credit card needed.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="firstName" className={labelClass}>First name</label>
                <input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  className={inputClass}
                  placeholder="Alex"
                />
                {errors.firstName && <p className={fieldErrorClass}>{errors.firstName}</p>}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="lastName" className={labelClass}>Last name</label>
                <input
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  className={inputClass}
                  placeholder="Kim"
                />
                {errors.lastName && <p className={fieldErrorClass}>{errors.lastName}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className={labelClass}>Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
              {errors.email && <p className={fieldErrorClass}>{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className={labelClass}>Password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                className={inputClass}
                placeholder="At least 8 characters"
              />
              {errors.password && <p className={fieldErrorClass}>{errors.password}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className={labelClass}>Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => set("confirmPassword", e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
              {errors.confirmPassword && <p className={fieldErrorClass}>{errors.confirmPassword}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="dob" className={labelClass}>Date of birth</label>
              <input
                id="dob"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => set("dateOfBirth", e.target.value)}
                className={inputClass}
              />
              {errors.dateOfBirth && <p className={fieldErrorClass}>{errors.dateOfBirth}</p>}
              <p className="text-[11px] text-slate-400">Required for age-appropriate content settings.</p>
            </div>

            <div className="space-y-1">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.terms}
                  onChange={(e) => set("terms", e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-lime-600"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  I agree to the{" "}
                  <Link href="/legal" className="font-medium text-lime-700 underline underline-offset-2 hover:text-lime-900 dark:text-lime-400">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/legal" className="font-medium text-lime-700 underline underline-offset-2 hover:text-lime-900 dark:text-lime-400">
                    Privacy Policy
                  </Link>
                </span>
              </label>
              {errors.terms && <p className={fieldErrorClass}>{errors.terms}</p>}
            </div>

            {errors.submit && (
              <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                {errors.submit}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl border-b-4 border-lime-700 bg-lime-500 py-4 text-base font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2 disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>

            <div className="relative flex items-center gap-3 py-1">
              <div className="flex-1 border-t border-slate-200 dark:border-slate-800" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">or</span>
              <div className="flex-1 border-t border-slate-200 dark:border-slate-800" />
            </div>

            <button
              type="button"
              onClick={() => { setLoading(true); signIn("google", { redirectTo: "/onboarding" }) }}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign up with Google
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-lime-700 hover:text-lime-900 dark:text-lime-400 dark:hover:text-lime-200">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
