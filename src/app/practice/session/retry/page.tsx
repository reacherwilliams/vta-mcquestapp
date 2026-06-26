import Link from "next/link"
import { resolveAccent, ACCENTS } from "@/lib/accents"
import { cn } from "@/lib/utils"

export const metadata = { title: "One more round?" }

type SearchParams = Promise<{
  qids?: string
  pass?: string
  run?: string
  style?: string
  accent?: string
}>

function resolveStyle(raw: string | undefined): "duo" | "swiss" {
  return raw === "swiss" ? "swiss" : "duo"
}

export default async function RetryPage({ searchParams }: { searchParams: SearchParams }) {
  const { qids: qidsParam, pass: passParam, run: runParam, style, accent } = await searchParams

  const qids = qidsParam ? qidsParam.split(",").filter(Boolean) : []
  const pass = Math.max(1, Number(passParam ?? 1) || 1)
  const run = runParam ?? "direct"
  const styleKey = resolveStyle(style)
  const accentKey = resolveAccent(accent)
  const theme = ACCENTS[accentKey]

  const count = qids.length
  const sharedParams = `run=${run}&style=${styleKey}&accent=${accentKey}`

  // Bump pass so options get a fresh shuffle on retry
  const retryHref = `/practice/session?qids=${qids.join(",")}&q=0&wrong=&pass=${pass + 1}&${sharedParams}`
  const completeHref = `/practice/session/complete?${sharedParams}`

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 dark:bg-slate-950">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-3">
          <div
            className={cn(
              "mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl",
              "bg-rose-100 dark:bg-rose-950/40",
            )}
          >
            <span className="font-black text-rose-600 dark:text-rose-400">{count}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {count === 1 ? "One to revisit" : `${count} to revisit`}
          </h1>
          <p className="text-base text-slate-500 dark:text-slate-400">
            You got {count === 1 ? "one question" : `${count} questions`} wrong.{" "}
            Want to give {count === 1 ? "it" : "them"} another shot?
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href={retryHref}
            className={cn(
              "w-full rounded-2xl border-b-4 py-4 text-center text-base font-black uppercase tracking-widest transition active:translate-y-px active:border-b-2",
              theme.duoCtaBorder,
              theme.duoCtaFill,
            )}
          >
            Let&rsquo;s go →
          </Link>
          <Link
            href={completeHref}
            className="text-sm font-medium text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
          >
            Skip — I&rsquo;m done
          </Link>
        </div>
      </div>
    </div>
  )
}
