"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

type Props =
  | { mode: "none"; userId: string; initialJoinCode?: string }
  | {
      mode: "member"
      userId: string
      squad: { id: string; name: string; inviteCode: string }
      isLeader: boolean
    }

export function SquadClient(props: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  if (props.mode === "member") {
    return <MemberActions {...props} router={router} startTransition={startTransition} />
  }
  return (
    <NoSquadView
      userId={props.userId}
      initialJoinCode={props.initialJoinCode}
      router={router}
      startTransition={startTransition}
    />
  )
}

// ── No-squad view: create or join ─────────────────────────────────────────────

function NoSquadView({
  initialJoinCode,
  router,
  startTransition,
}: {
  userId: string
  initialJoinCode?: string
  router: ReturnType<typeof useRouter>
  startTransition: (fn: () => void) => void
}) {
  const [tab, setTab] = useState<"create" | "join">(initialJoinCode ? "join" : "create")
  const [name, setName] = useState("")
  const [code, setCode] = useState(initialJoinCode ?? "")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function create() {
    setError("")
    setLoading(true)
    const res = await fetch("/api/squads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? "Failed to create squad.")
      return
    }
    startTransition(() => router.refresh())
  }

  async function join() {
    setError("")
    setLoading(true)
    const res = await fetch("/api/squads/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: code }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? "Failed to join squad.")
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div className="mt-6">
      {/* Tab picker */}
      <div className="mb-4 flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-800">
        {(["create", "join"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              tab === t
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {t === "create" ? "Create squad" : "Join with code"}
          </button>
        ))}
      </div>

      {tab === "create" ? (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Squad name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-lime-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            onClick={create}
            disabled={loading || !name.trim()}
            className="w-full rounded-xl bg-lime-500 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-50 hover:bg-lime-600"
          >
            {loading ? "Creating…" : "Create squad"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Invite code (e.g. XK9F2LBQ)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={10}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm tracking-widest uppercase focus:border-lime-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            onClick={join}
            disabled={loading || !code.trim()}
            className="w-full rounded-xl bg-lime-500 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-50 hover:bg-lime-600"
          >
            {loading ? "Joining…" : "Join squad"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
    </div>
  )
}

// ── Member view: invite link + leave ─────────────────────────────────────────

function MemberActions({
  squad,
  isLeader,
  router,
  startTransition,
}: {
  userId: string
  squad: { id: string; name: string; inviteCode: string }
  isLeader: boolean
  router: ReturnType<typeof useRouter>
  startTransition: (fn: () => void) => void
}) {
  const [copied, setCopied] = useState(false)
  const [showLeave, setShowLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)

  function copyInvite() {
    const link = `${window.location.origin}/practice/squad?join=${squad.inviteCode}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function leave() {
    setLeaving(true)
    await fetch("/api/squads/me", { method: "DELETE" })
    setLeaving(false)
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={copyInvite}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-lime-400 hover:text-lime-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-lime-600 dark:hover:text-lime-400"
      >
        {copied ? "Copied!" : "Copy invite"}
      </button>

      {showLeave ? (
        <div className="flex items-center gap-1">
          <button
            onClick={leave}
            disabled={leaving}
            className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
          >
            {isLeader ? (leaving ? "Leaving…" : "Leave & transfer") : (leaving ? "Leaving…" : "Confirm leave")}
          </button>
          <button
            onClick={() => setShowLeave(false)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowLeave(true)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:border-rose-300 hover:text-rose-500 dark:border-slate-700 dark:text-slate-500"
        >
          Leave
        </button>
      )}
    </div>
  )
}
