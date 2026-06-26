"use client"

import { createPortal } from "react-dom"
import Link from "next/link"

type Props = { onClose: () => void }

export function UpgradeModal({ onClose }: Props) {
  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Flame */}
        <div className="mb-4 text-center text-5xl">🔥</div>

        <h2 className="text-center text-xl font-black text-slate-900 dark:text-slate-100">
          You&apos;re on a roll — keep going!
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
          You&apos;ve hit your 10 free questions for today. Upgrade to Pro for unlimited daily questions, leagues, and exam mode.
        </p>

        <div className="mt-6 space-y-3">
          <Link
            href="/pricing"
            className="block w-full rounded-xl border-b-4 border-lime-700 bg-lime-500 py-3 text-center text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2"
          >
            See Pro pricing
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Come back tomorrow
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
