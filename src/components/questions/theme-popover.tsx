"use client"

import Link from "next/link"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { ACCENTS, ACCENT_KEYS, type Accent } from "@/lib/accents"

const STYLES = {
  duo: "Duolingo",
  swiss: "Swiss",
} as const

type StyleKey = keyof typeof STYLES

type Props = {
  questionIndex: number
  currentStyle: StyleKey
  currentAccent: Accent
}

export function ThemePopover({ questionIndex, currentStyle, currentAccent }: Props) {
  const [open, setOpen] = useState(false)
  const base = `q=${questionIndex}`

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change theme"
        aria-expanded={open}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition",
          open
            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
        )}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="3" fill="currentColor" />
          <circle cx="8" cy="2" r="1.5" fill="currentColor" />
          <circle cx="8" cy="14" r="1.5" fill="currentColor" />
          <circle cx="2" cy="8" r="1.5" fill="currentColor" />
          <circle cx="14" cy="8" r="1.5" fill="currentColor" />
          <circle cx="3.5" cy="3.5" r="1.5" fill="currentColor" />
          <circle cx="12.5" cy="12.5" r="1.5" fill="currentColor" />
          <circle cx="12.5" cy="3.5" r="1.5" fill="currentColor" />
          <circle cx="3.5" cy="12.5" r="1.5" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-10 z-40 w-52 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Style
            </p>
            <div className="mb-3 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {(Object.keys(STYLES) as StyleKey[]).map((key) => (
                <Link
                  key={key}
                  href={`/practice/demo?${base}&style=${key}&accent=${currentAccent}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex-1 rounded-lg py-1.5 text-center text-xs font-semibold transition",
                    key === currentStyle
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
                  )}
                >
                  {STYLES[key]}
                </Link>
              ))}
            </div>

            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Colour
            </p>
            <div className="grid grid-cols-6 gap-2">
              {ACCENT_KEYS.map((key) => (
                <Link
                  key={key}
                  href={`/practice/demo?${base}&style=${currentStyle}&accent=${key}`}
                  onClick={() => setOpen(false)}
                  aria-label={ACCENTS[key].label}
                  title={ACCENTS[key].label}
                  className={cn(
                    "h-6 w-6 rounded-full transition hover:scale-110",
                    ACCENTS[key].swatch,
                    key === currentAccent && "ring-2 ring-slate-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-slate-900",
                  )}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
