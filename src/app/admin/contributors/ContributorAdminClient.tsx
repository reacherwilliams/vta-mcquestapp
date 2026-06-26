"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

type Application = {
  id: string
  status: string
  statement: string
  sampleUrl: string | null
  notes: string | null
  createdAt: string
  user: { id: string; firstName: string; lastName: string; email: string }
}

type Contributor = {
  id: string
  firstName: string
  lastName: string
  email: string
  stripeConnectId: string | null
  questionCount: number
}

export function ContributorAdminClient({
  applications: initial,
  contributors,
}: {
  applications: Application[]
  contributors: Contributor[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [apps, setApps] = useState(initial)
  const [tab, setTab] = useState<"applications" | "contributors">("applications")
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<string | null>(null)

  const pending = apps.filter((a) => a.status === "PENDING")
  const reviewed = apps.filter((a) => a.status !== "PENDING")

  async function decide(id: string, decision: "APPROVED" | "REJECTED") {
    setLoading(id)
    await fetch(`/api/admin/contributors/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, notes: notes[id] }),
    })
    setLoading(null)
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status: decision, notes: notes[id] ?? null } : a)))
    startTransition(() => router.refresh())
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })

  return (
    <div>
      {/* Tab picker */}
      <div className="mb-6 flex rounded-xl border border-slate-200 bg-slate-100 p-1 w-fit dark:border-slate-800 dark:bg-slate-800">
        {(["applications", "contributors"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            {t === "applications" ? `Applications (${pending.length} pending)` : `Active (${contributors.length})`}
          </button>
        ))}
      </div>

      {tab === "applications" ? (
        <div className="space-y-4">
          {pending.length === 0 && <p className="text-sm text-slate-400">No pending applications.</p>}
          {pending.map((a) => (
            <div key={a.id} className="rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/10">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {a.user.firstName} {a.user.lastName}
                  </p>
                  <p className="text-xs text-slate-400">{a.user.email} · {fmt(a.createdAt)}</p>
                </div>
                {a.sampleUrl && (
                  <a href={a.sampleUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-lime-600 underline hover:text-lime-700">
                    Sample work →
                  </a>
                )}
              </div>
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{a.statement}</p>
              <textarea
                placeholder="Admin notes (optional, shown to applicant)"
                value={notes[a.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [a.id]: e.target.value }))}
                rows={2}
                className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-lime-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => decide(a.id, "APPROVED")}
                  disabled={loading === a.id}
                  className="rounded-xl bg-lime-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50 hover:bg-lime-600"
                >
                  {loading === a.id ? "…" : "Approve"}
                </button>
                <button
                  onClick={() => decide(a.id, "REJECTED")}
                  disabled={loading === a.id}
                  className="rounded-xl border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-500 disabled:opacity-50 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/20"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}

          {reviewed.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
                Show {reviewed.length} reviewed application{reviewed.length !== 1 ? "s" : ""}
              </summary>
              <div className="mt-3 space-y-2">
                {reviewed.map((a) => (
                  <div key={a.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                      <p className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {a.user.firstName} {a.user.lastName}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        a.status === "APPROVED"
                          ? "bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400"
                          : "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                      }`}>
                        {a.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-500">Name</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Email</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Questions</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Stripe</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {contributors.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                    {c.firstName} {c.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.email}</td>
                  <td className="px-4 py-3 text-slate-500">{c.questionCount}</td>
                  <td className="px-4 py-3">
                    {c.stripeConnectId ? (
                      <span className="text-lime-600 dark:text-lime-400">Connected</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <a href={`/contributors/${c.id}`} className="text-lime-600 hover:underline dark:text-lime-400">
                      View →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
