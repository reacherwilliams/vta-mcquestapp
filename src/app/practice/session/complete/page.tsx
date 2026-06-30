import Link from "next/link"
import { resolveAccent, ACCENTS } from "@/lib/accents"
import { auth } from "@/lib/auth"
import { cn } from "@/lib/utils"

export const metadata = { title: "All done!" }

type SearchParams = Promise<{
  style?: string
  accent?: string
}>

function resolveStyle(raw: string | undefined): "duo" | "swiss" {
  return raw === "swiss" ? "swiss" : "duo"
}

export default async function CompletePage({ searchParams }: { searchParams: SearchParams }) {
  const { style, accent } = await searchParams
  const styleKey = resolveStyle(style)
  const accentKey = resolveAccent(accent)
  const theme = ACCENTS[accentKey]

  const session = await auth()
  const isGuest = !session?.user?.id

  const filterHref = `/practice/filter?style=${styleKey}&accent=${accentKey}`

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 dark:bg-slate-950">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
            {/* Checkmark */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            Nailed it!
          </h1>
          <p className="text-base text-slate-500 dark:text-slate-400">
            Every question answered correctly. Keep the momentum going.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href={filterHref}
            className={cn(
              "w-full rounded-2xl border-b-4 py-4 text-center text-base font-black uppercase tracking-widest transition active:translate-y-px active:border-b-2",
              theme.duoCtaBorder,
              theme.duoCtaFill,
            )}
          >
            Next Chapter →
          </Link>
          <Link
            href={filterHref}
            className="text-sm font-medium text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
          >
            Choose a different topic
          </Link>
        </div>

        {/* Guest conversion: register to unlock the real bank + persistent mistake retries */}
        {isGuest && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Liked that? Make it count.</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Create a free account to unlock the full question bank, track your progress, and have every
              question you get wrong saved so you can retry your mistakes anytime.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Link
                href="/register"
                className="rounded-xl bg-lime-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400"
              >
                Create free account
              </Link>
              <Link href="/login" className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                I already have one
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
