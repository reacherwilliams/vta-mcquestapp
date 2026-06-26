"use client"

import { useEffect, useState } from "react"

type Props = {
  amount: number
  onDone: () => void
}

/**
 * Floating "+N XP" toast that animates up and fades out.
 * Mount it; it self-destructs after the animation.
 */
export function XpToast({ amount, onDone }: Props) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onDone, 300)
    }, 1200)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      className={`pointer-events-none fixed bottom-28 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
      }`}
    >
      <div className="flex items-center gap-1.5 rounded-full bg-lime-500 px-4 py-2 shadow-lg shadow-lime-500/30">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-900" fill="currentColor">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        <span className="text-sm font-black text-slate-900">+{amount} XP</span>
      </div>
    </div>
  )
}
