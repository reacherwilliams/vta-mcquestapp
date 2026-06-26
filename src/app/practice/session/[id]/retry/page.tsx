import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { resolveAccent, ACCENTS } from "@/lib/accents"
import { cn } from "@/lib/utils"

export const metadata = { title: "One more round?" }

type SearchParams = Promise<{
  count?: string
  style?: string
  accent?: string
}>

function resolveStyle(raw: string | undefined): "duo" | "swiss" {
  return raw === "swiss" ? "swiss" : "duo"
}

export default async function DbRetryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id: sessionId } = await params
  const { count: countParam, style, accent } = await searchParams

  const count = Math.max(1, Number(countParam ?? 1) || 1)
  const styleKey = resolveStyle(style)
  const accentKey = resolveAccent(accent)
  const theme = ACCENTS[accentKey]

  const sharedParams = `style=${styleKey}&accent=${accentKey}`
  const completeHref = `/practice/session/complete?${sharedParams}`
  // The "Let's go" target creates a fresh WRONG_RETRY session then redirects
  const retryHref = `/api/sessions/wrong-retry-redirect?${sharedParams}`

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
          <a
            href={retryHref}
            className={cn(
              "w-full rounded-2xl border-b-4 py-4 text-center text-base font-black uppercase tracking-widest transition active:translate-y-px active:border-b-2",
              theme.duoCtaBorder,
              theme.duoCtaFill,
            )}
          >
            Let&rsquo;s go →
          </a>
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
