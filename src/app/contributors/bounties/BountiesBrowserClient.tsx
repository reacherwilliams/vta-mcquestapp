"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

type BountyRow = {
  id: string
  count: number
  filledCount: number
  year: number | null
  difficulty: string | null
  notes: string | null
  status: string
  claimedAt: Date | null
  claimExpiresAt: Date | null
  curriculum: { code: string; displayName: string }
  subject:    { code: string; name: string }
  chapter:    { name: string } | null
  claimedBy:  { id: string; firstName: string; lastName: string } | null
}

type Props = {
  currentUserId: string
  myClaims:     BountyRow[]
  openBounties: BountyRow[]
  othersClaims: BountyRow[]
}

export function BountiesBrowserClient({ myClaims, openBounties, othersClaims }: Props) {
  return (
    <div className="space-y-8">
      <Section title="Your active claims" empty="You haven’t claimed any bounties.">
        {myClaims.map((b) => <Card key={b.id} b={b} mode="mine" />)}
      </Section>

      <Section title={`Open bounties · ${openBounties.length}`} empty="No open bounties right now — check back soon.">
        {openBounties.map((b) => <Card key={b.id} b={b} mode="claimable" />)}
      </Section>

      {othersClaims.length > 0 && (
        <Section title="Claimed by other contributors" empty="">
          {othersClaims.map((b) => <Card key={b.id} b={b} mode="taken" />)}
        </Section>
      )}
    </div>
  )
}

function Section({ title, children, empty }: { title: string; children: React.ReactNode; empty: string }) {
  const arr = Array.isArray(children) ? children : [children]
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{title}</h2>
      {arr.length === 0 ? (
        empty ? <p className="text-sm text-slate-400 dark:text-slate-500">{empty}</p> : null
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  )
}

function Card({ b, mode }: { b: BountyRow; mode: "mine" | "claimable" | "taken" }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act(path: string) {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/bounties/${b.id}/${path}`, { method: "POST" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Action failed.")
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const expires = b.claimExpiresAt ? new Date(b.claimExpiresAt) : null
  const daysLeft = expires ? Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86_400_000)) : null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {b.curriculum.code}
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {b.subject.name}
            </span>
            {b.chapter && <span className="text-xs text-slate-500 dark:text-slate-400">· {b.chapter.name}</span>}
            {b.year && <span className="text-xs text-slate-500 dark:text-slate-400">· {b.year}</span>}
            {b.difficulty && (
              <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700 dark:bg-sky-950/40 dark:text-sky-400">
                {b.difficulty}
              </span>
            )}
          </div>
          {b.notes && (
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">{b.notes}</p>
          )}
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-semibold tabular-nums">{b.filledCount} / {b.count}</span> questions submitted
            {mode === "mine" && daysLeft !== null && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                {daysLeft === 0 ? "Expires today" : `${daysLeft}d left`}
              </span>
            )}
            {mode === "taken" && b.claimedBy && (
              <span className="ml-2">— claimed by {b.claimedBy.firstName} {b.claimedBy.lastName}</span>
            )}
          </p>
        </div>

        {/* Action */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {mode === "claimable" && (
            <button
              disabled={busy}
              onClick={() => act("claim")}
              className="rounded-xl border-b-4 border-lime-700 bg-lime-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2 disabled:opacity-50"
            >
              {busy ? "Claiming…" : "Claim"}
            </button>
          )}
          {mode === "mine" && (
            <>
              <Link
                href="/admin/questions/new"
                className="rounded-xl border-b-4 border-lime-700 bg-lime-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2"
              >
                Write
              </Link>
              <button
                disabled={busy}
                onClick={() => act("release")}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                {busy ? "Releasing…" : "Release"}
              </button>
            </>
          )}
        </div>
      </div>
      {error && (
        <p className="mt-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  )
}
