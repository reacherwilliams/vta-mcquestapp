"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

type EventRow = {
  id: string
  title: string
  questionIds: string[]
  startsAt: string
  endsAt: string
  entryCount: number
  active: boolean
}

export function MarathonAdminClient({ events: initial }: { events: EventRow[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [events, setEvents] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [qIds, setQIds] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function create() {
    setError("")
    const questionIds = qIds.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
    if (!title.trim() || !questionIds.length || !startsAt || !endsAt) {
      setError("All fields are required.")
      return
    }
    setLoading(true)
    const res = await fetch("/api/admin/marathon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, questionIds, startsAt, endsAt }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? "Failed to create event.")
      return
    }
    setTitle(""); setQIds(""); setStartsAt(""); setEndsAt("")
    setShowForm(false)
    startTransition(() => router.refresh())
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this marathon event?")) return
    await fetch(`/api/admin/marathon?id=${id}`, { method: "DELETE" })
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowForm((v) => !v)}
        className="rounded-xl bg-lime-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-lime-600"
      >
        {showForm ? "Cancel" : "+ New event"}
      </button>

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">New marathon event</h2>
          <input
            type="text"
            placeholder="Event title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-lime-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <textarea
            placeholder="Question IDs (comma or newline separated, 1–20 IDs)"
            value={qIds}
            onChange={(e) => setQIds(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-xs focus:border-lime-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Starts at (local)</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Ends at (local)</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <button
            onClick={create}
            disabled={loading}
            className="rounded-xl bg-lime-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:bg-lime-600"
          >
            {loading ? "Creating…" : "Create event"}
          </button>
        </div>
      )}

      {events.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">No events yet.</p>
      ) : (
        <div className="space-y-3">
          {events.map((e) => (
            <div
              key={e.id}
              className={`rounded-2xl border p-4 ${
                e.active
                  ? "border-lime-400 bg-lime-50 dark:border-lime-700 dark:bg-lime-950/20"
                  : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{e.title}</p>
                    {e.active && (
                      <span className="rounded-full bg-lime-500 px-2 py-0.5 text-[10px] font-bold text-white">LIVE</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {e.questionIds.length} questions · {e.entryCount} entries · {fmt(e.startsAt)} → {fmt(e.endsAt)}
                  </p>
                </div>
                <button
                  onClick={() => deleteEvent(e.id)}
                  className="shrink-0 rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/30"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
