"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s"
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s % 60}s`
}

type Props =
  | { mode: "join" }
  | { mode: "countdown"; endsAt: string }

export function LeagueClient(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState("")

  useEffect(() => {
    if (props.mode !== "countdown") return
    const end = new Date(props.endsAt).getTime()
    function tick() { setTimeLeft(formatCountdown(end - Date.now())) }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [props.mode === "countdown" ? props.endsAt : ""])

  if (props.mode === "countdown") {
    return (
      <>
        <p className="mt-1 text-2xl font-black tabular-nums text-slate-900 dark:text-slate-100">
          {timeLeft || "…"}
        </p>
        <p className="text-xs text-slate-400">until Sunday</p>
      </>
    )
  }

  async function join() {
    setError(null)
    startTransition(async () => {
      const res = await fetch("/api/leagues/join", { method: "POST" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Something went wrong.")
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <button
        onClick={join}
        disabled={isPending}
        className="rounded-xl bg-lime-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-lime-700 disabled:opacity-60"
      >
        {isPending ? "Joining…" : "Join this week's league"}
      </button>
      {error && <p className="text-xs text-rose-500">{error}</p>}
      <p className="text-xs text-slate-400 dark:text-slate-500">
        New users start in Bronze. Climb by earning XP.
      </p>
    </div>
  )
}
