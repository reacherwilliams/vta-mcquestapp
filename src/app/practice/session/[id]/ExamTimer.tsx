"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"

type Props = {
  expiresAt: string // ISO string
  sessionId: string
}

function fmt(ms: number): string {
  if (ms <= 0) return "0:00"
  const totalSec = Math.ceil(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${m}:${String(s).padStart(2, "0")}`
}

export function ExamTimer({ expiresAt, sessionId }: Props) {
  const router = useRouter()
  const [ms, setMs] = useState(() => new Date(expiresAt).getTime() - Date.now())
  const fired = useRef(false)

  useEffect(() => {
    const end = new Date(expiresAt).getTime()
    const id = setInterval(() => {
      const remaining = end - Date.now()
      setMs(remaining)
      if (remaining <= 0 && !fired.current) {
        fired.current = true
        clearInterval(id)
        // Force-complete the session then navigate to summary
        fetch(`/api/sessions/${sessionId}`, { method: "PATCH" }).finally(() => {
          router.push(`/practice/session/${sessionId}/summary`)
        })
      }
    }, 500)
    return () => clearInterval(id)
  }, [expiresAt, sessionId, router])

  const urgent = ms < 5 * 60 * 1000 // under 5 minutes
  const critical = ms < 60 * 1000   // under 1 minute

  return (
    <div
      className={[
        "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-mono font-bold tabular-nums transition",
        critical
          ? "animate-pulse bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
          : urgent
            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      ].join(" ")}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
      {fmt(ms)}
    </div>
  )
}
