import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { BottomNav } from "../BottomNav"

export const metadata = { title: "Revision Deck" }

export default async function RevisionDeckPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/practice/revision-deck")
  const userId = session.user.id

  const [unresolvedRaw, vanquishedRaw] = await Promise.all([
    prisma.wrongAnswer.findMany({
      where: { userId, resolvedAt: null },
      include: {
        question: {
          select: {
            stem: true,
            difficulty: true,
            subject: { select: { name: true } },
            chapter: { select: { name: true } },
          },
        },
      },
      orderBy: { firstWrongAt: "asc" },
    }),
    prisma.wrongAnswer.count({ where: { userId, resolvedAt: { not: null } } }),
  ])

  const unresolved = unresolvedRaw.map((wa) => ({
    id: wa.id,
    questionId: wa.questionId,
    retryCount: wa.retryCount,
    firstWrongAt: wa.firstWrongAt,
    subject: wa.question.subject.name,
    chapter: wa.question.chapter.name,
    difficulty: wa.question.difficulty,
    // Extract text preview from stem (first text block)
    preview: (() => {
      const stem = wa.question.stem as { kind: string; text?: string }[]
      const block = Array.isArray(stem) ? stem.find((b) => b.kind === "text") : null
      return block?.text ?? "Question"
    })(),
  }))

  const difficultyColor: Record<string, string> = {
    EASY: "text-emerald-600 dark:text-emerald-400",
    MEDIUM: "text-amber-600 dark:text-amber-400",
    HARD: "text-rose-600 dark:text-rose-400",
    CHALLENGE: "text-rose-700 dark:text-rose-300 font-black",
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <div className="h-1 bg-linear-to-r from-orange-500 via-amber-500 to-lime-500" />

      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur dark:border-slate-900 dark:bg-slate-950/95">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-3 sm:px-10">
          <div className="flex items-center gap-3">
            <Link
              href="/practice"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-2xl font-light leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              ←
            </Link>
            <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Revision Deck
            </h1>
          </div>
          {vanquishedRaw > 0 && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {vanquishedRaw} vanquished
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-28 pt-6 sm:px-10">
        {unresolved.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="text-5xl">🏆</div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              All caught up!
            </h2>
            <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
              {vanquishedRaw > 0
                ? `You've mastered all ${vanquishedRaw} question${vanquishedRaw === 1 ? "" : "s"}. Keep the streak going.`
                : "No questions to revisit yet. Answer some questions and the ones you miss will appear here."}
            </p>
            <Link
              href="/practice/filter"
              className="mt-2 rounded-2xl border-b-4 border-lime-700 bg-lime-500 px-8 py-3 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2"
            >
              Practice now →
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <span className="font-bold text-rose-600 dark:text-rose-400">{unresolved.length}</span>{" "}
                {unresolved.length === 1 ? "question" : "questions"} to revisit
              </p>
              <a
                href="/api/sessions/wrong-retry-redirect?style=duo&accent=lime"
                className="rounded-xl border-b-2 border-lime-700 bg-lime-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b"
              >
                Retry all →
              </a>
            </div>

            <div className="space-y-3">
              {unresolved.map((wa) => (
                <div
                  key={wa.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {wa.subject}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {wa.chapter}
                    </span>
                    <span className={cn("ml-auto text-[10px] font-semibold uppercase tracking-wide", difficultyColor[wa.difficulty])}>
                      {wa.difficulty}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-slate-700 dark:text-slate-300">
                    {wa.preview}
                  </p>
                  {wa.retryCount > 0 && (
                    <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                      Retried {wa.retryCount}× — still not got it
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
