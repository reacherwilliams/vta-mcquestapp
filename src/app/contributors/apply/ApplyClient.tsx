"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function ApplyClient({ firstName }: { firstName: string }) {
  const router = useRouter()
  const [statement, setStatement] = useState("")
  const [sampleUrl, setSampleUrl] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    setError("")
    if (statement.trim().length < 50) {
      setError("Please write at least 50 characters.")
      return
    }
    setLoading(true)
    const res = await fetch("/api/contributors/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statement, sampleUrl: sampleUrl || undefined }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? "Failed to submit.")
      return
    }
    setDone(true)
    router.refresh()
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-lime-400 bg-lime-50 p-6 dark:border-lime-700 dark:bg-lime-950/20">
        <p className="text-sm font-semibold text-lime-700 dark:text-lime-400">Application submitted!</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          We&apos;ll review your application and get back to you via email within a few days.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Why do you want to contribute, {firstName}?
        </label>
        <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">
          Tell us about your subject expertise and what kinds of questions you&apos;d write. Minimum 50 characters.
        </p>
        <textarea
          rows={5}
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          placeholder="I'm a Chemistry teacher with 8 years of experience writing IGCSE papers…"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed focus:border-lime-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <p className="mt-1 text-right text-xs text-slate-400">{statement.trim().length} / 50 min</p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Sample work URL <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          type="url"
          value={sampleUrl}
          onChange={(e) => setSampleUrl(e.target.value)}
          placeholder="https://docs.google.com/…"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-lime-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      {error && <p className="text-sm text-rose-500">{error}</p>}

      <button
        onClick={submit}
        disabled={loading}
        className="w-full rounded-xl bg-lime-500 py-3 text-sm font-bold text-white disabled:opacity-50 hover:bg-lime-600"
      >
        {loading ? "Submitting…" : "Submit application"}
      </button>

      <p className="text-center text-xs text-slate-400 dark:text-slate-500">
        By applying you agree to our contributor guidelines and revenue share terms.
      </p>
    </div>
  )
}
