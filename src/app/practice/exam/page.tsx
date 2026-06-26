import "server-only"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { EXAM_PRESETS } from "@/lib/sessions/practice"
import Link from "next/link"
import { ExamClient } from "./ExamClient"

export const metadata = { title: "Exam Mode" }

export default async function ExamPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  // Check subscription — exam mode is Pro only
  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { plan: true },
  })
  const isPro = sub?.plan === "PRO" || sub?.plan === "PRO_FAMILY"

  // Load subjects for custom preset
  const subjects = await prisma.subject.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      curriculum: { select: { displayName: true } },
      chapters: { where: { isActive: true }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ curriculum: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  })

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <div className="h-1 bg-linear-to-r from-orange-500 via-amber-500 to-lime-500" />

      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur dark:border-slate-900 dark:bg-slate-950/95">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-4 px-6 py-3 sm:px-10">
          <Link href="/practice" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-2xl font-light leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">←</Link>
          <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Exam Mode</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        {!isPro && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-800/40 dark:bg-amber-950/30">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <div className="flex-1 text-sm text-amber-800 dark:text-amber-300">
              <span className="font-bold">Exam Mode is a Pro feature.</span>{" "}
              <Link href="/pricing" className="underline underline-offset-2">Upgrade to unlock →</Link>
            </div>
          </div>
        )}

        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Choose a preset</h2>

        <ExamClient presets={EXAM_PRESETS} subjects={subjects} isPro={isPro} />
      </main>
    </div>
  )
}
