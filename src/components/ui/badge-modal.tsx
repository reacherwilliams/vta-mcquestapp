"use client"

import { createPortal } from "react-dom"
import { useEffect, useState } from "react"

const BADGE_META: Record<string, { name: string; emoji: string; rarity: string }> = {
  first_correct:   { name: "First blood",    emoji: "🎯", rarity: "Common"    },
  streak_7:        { name: "On a roll",       emoji: "🔥", rarity: "Rare"      },
  streak_30:       { name: "Unstoppable",     emoji: "⚡", rarity: "Epic"      },
  first_retry:     { name: "Face your fears", emoji: "💪", rarity: "Common"    },
  perfect_session: { name: "Flawless",        emoji: "⭐", rarity: "Rare"      },
  speed_demon:     { name: "Speed demon",     emoji: "⚡", rarity: "Epic"      },
}

const RARITY_COLOR: Record<string, string> = {
  Common:    "text-slate-500",
  Rare:      "text-sky-600 dark:text-sky-400",
  Epic:      "text-amber-600 dark:text-amber-400",
  Legendary: "text-rose-600 dark:text-rose-400",
}

type Props = {
  badgeKey: string
  onClose: () => void
}

export function BadgeModal({ badgeKey, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const meta = BADGE_META[badgeKey] ?? { name: badgeKey, emoji: "🏅", rarity: "Common" }

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs space-y-5 rounded-3xl bg-white p-8 text-center shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-4xl dark:bg-amber-950/30">
          {meta.emoji}
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Badge unlocked
          </p>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {meta.name}
          </h2>
          <p className={`text-xs font-bold uppercase tracking-widest ${RARITY_COLOR[meta.rarity] ?? RARITY_COLOR.Common}`}>
            {meta.rarity}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-2xl border-b-4 border-lime-700 bg-lime-500 py-3 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2"
        >
          Nice!
        </button>
      </div>
    </div>,
    document.body,
  )
}
