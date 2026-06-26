import "server-only"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await prisma.user.findUnique({ where: { id }, select: { firstName: true, lastName: true } })
  if (!user) return { title: "Contributor" }
  return { title: `${user.firstName} ${user.lastName} — Contributor` }
}

export default async function ContributorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      firstName: true,
      lastName: true,
      image: true,
      role: true,
      createdAt: true,
    },
  })

  if (!user || (user.role !== "CONTRIBUTOR" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    notFound()
  }

  const questions = await prisma.question.findMany({
    where: { authorId: id, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      difficulty: true,
      chapter: { select: { name: true } },
      subject: { select: { name: true } },
      _count: { select: { attempts: true } },
    },
  })

  const totalImpressions = questions.reduce((s, q) => s + q._count.attempts, 0)

  const DIFF_COLOR: Record<string, string> = {
    EASY: "bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400",
    MEDIUM: "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
    HARD: "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
    CHALLENGE: "bg-rose-200 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      {/* Profile header */}
      <div className="mb-8 flex items-center gap-5">
        {user.image ? (
          <img src={user.image} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-lime-100 text-xl font-black text-lime-600 dark:bg-lime-950/40">
            {user.firstName[0]}{user.lastName[0]}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {user.firstName} {user.lastName}
          </h1>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            Contributor · {questions.length} published questions · {totalImpressions.toLocaleString()} impressions
          </p>
        </div>
      </div>

      {/* Questions list */}
      {questions.length === 0 ? (
        <p className="text-sm text-slate-400">No published questions yet.</p>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <Link
              key={q.id}
              href={`/practice/filter?questionId=${q.id}`}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {q.subject.name} — {q.chapter.name}
                </p>
                <p className="text-xs text-slate-400">{q._count.attempts.toLocaleString()} attempts</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${DIFF_COLOR[q.difficulty] ?? ""}`}>
                {q.difficulty}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Link href="/contributors/apply" className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          Become a contributor →
        </Link>
      </div>
    </div>
  )
}
