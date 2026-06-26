import Link from "next/link"
import { resolveAccent, ACCENTS } from "@/lib/accents"
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
      </div>
    </div>
  )
}
