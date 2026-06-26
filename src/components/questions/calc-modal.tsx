"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { ACCENTS, type Accent } from "@/lib/accents"

// Desmos embeds are free for educational / non-commercial use.
// For offline / Capacitor builds, replace with a mathjs-powered
// native calculator component (no iframe dependency).
const CALC_TABS = {
  scientific: {
    label: "Scientific",
    url: "https://www.desmos.com/scientific",
  },
  normal: {
    label: "Normal",
    url: "https://www.desmos.com/fourfunction",
  },
} as const

type TabKey = keyof typeof CALC_TABS

export function CalcModal({ accent = "lime" }: { accent?: Accent }) {
  const theme = ACCENTS[accent]
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabKey>("scientific")

  // Portal to document.body so backdrop-blur on parent sticky headers
  // (Duo mode) doesn't create a new containing block for fixed children.
  const modal = open
    ? createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className={cn("relative z-50 flex w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl border-t-4", theme.swissActiveRule.split(" ").filter(c => c.startsWith("border-")).join(" "))}>
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-3">
              <h2 className={cn("text-sm font-bold", theme.swissActiveLabel)}>
                Calculator
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close calculator"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex shrink-0 gap-1 px-5 pb-3">
              {(Object.keys(CALC_TABS) as TabKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-semibold transition",
                    key === tab
                      ? theme.duoChip
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
                  )}
                >
                  {CALC_TABS[key].label}
                </button>
              ))}
            </div>

            {/* iframe */}
            <div className="px-5 pb-5">
              <iframe
                key={tab}
                src={CALC_TABS[tab].url}
                title={`${CALC_TABS[tab].label} calculator`}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700"
                style={{ height: "min(420px, 55dvh)" }}
                allow="clipboard-write"
              />
              <p className="mt-2 text-center text-[10px] text-slate-400">
                Powered by{" "}
                <a
                  href="https://www.desmos.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Desmos
                </a>{" "}
                — free for educational use
              </p>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open calculator"
        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <rect x="3.5" y="3.5" width="2.5" height="2" rx="0.5" fill="currentColor" />
          <rect x="6.75" y="3.5" width="2.5" height="2" rx="0.5" fill="currentColor" />
          <rect x="10" y="3.5" width="2.5" height="2" rx="0.5" fill="currentColor" />
          <rect x="3.5" y="6.5" width="2.5" height="2" rx="0.5" fill="currentColor" />
          <rect x="6.75" y="6.5" width="2.5" height="2" rx="0.5" fill="currentColor" />
          <rect x="10" y="6.5" width="2.5" height="2" rx="0.5" fill="currentColor" />
          <rect x="3.5" y="9.5" width="2.5" height="3" rx="0.5" fill="currentColor" />
          <rect x="6.75" y="9.5" width="2.5" height="3" rx="0.5" fill="currentColor" />
          <rect x="10" y="9.5" width="2.5" height="3" rx="0.5" fill="currentColor" />
        </svg>
      </button>
      {modal}
    </>
  )
}
