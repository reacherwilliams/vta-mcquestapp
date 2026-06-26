import "server-only"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

export const metadata = { title: "Contributor Dashboard" }

export default async function ContributorDashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, firstName: true, stripeConnectId: true },
  })

  if (!user || (user.role !== "CONTRIBUTOR" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    redirect("/contributors/apply")
  }

  const questions = await prisma.question.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      difficulty: true,
      createdAt: true,
      lastReviewNote: true,
      chapter: { select: { name: true } },
      subject: { select: { name: true, curriculum: { select: { code: true } } } },
      _count: { select: { attempts: true, reviews: true } },
    },
  })

  const publishedIds = questions.filter((q) => q.status === "PUBLISHED").map((q) => q.id)

  const payouts = await prisma.contributorPayout.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { id: true, amountCents: true, periodStart: true, periodEnd: true, status: true },
  })

  const totalPaidCents = payouts.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amountCents, 0)
  const pendingCents = payouts.filter((p) => p.status === "PENDING").reduce((s, p) => s + p.amountCents, 0)

  const totalImpressions = questions.reduce((s, q) => s + q._count.attempts, 0)

  const fmt = (d: Date) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
  const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`

  const STATUS_CHIP: Record<string, string> = {
    DRAFT:                "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    IN_SUBJECT_REVIEW:    "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
    IN_CURRICULUM_REVIEW: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
    PUBLISHED:            "bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400",
    ARCHIVED:             "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
  }
  const STATUS_LABEL: Record<string, string> = {
    DRAFT:                "Draft",
    IN_SUBJECT_REVIEW:    "Subject Review",
    IN_CURRICULUM_REVIEW: "Curriculum Review",
    PUBLISHED:            "Published",
    ARCHIVED:             "Archived",
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Contributor Dashboard</h1>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Hi {user.firstName} 👋</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/contributors/bounties"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Bounty board
          </Link>
          <Link
            href="/admin/questions/new"
            className="rounded-xl bg-lime-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-lime-600"
          >
            + Write question
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Published", value: publishedIds.length },
          { label: "Impressions", value: totalImpressions.toLocaleString() },
          { label: "Total earned", value: usd(totalPaidCents) },
          { label: "Pending payout", value: usd(pendingCents) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">{value}</p>
          </div>
        ))}
      </div>

      {/* Stripe Connect CTA */}
      {!user.stripeConnectId && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Connect Stripe to receive payouts</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Set up Stripe Connect so we can transfer your earnings directly to your bank account.
          </p>
          <a
            href="/api/contributors/stripe-connect"
            className="mt-3 inline-block rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600"
          >
            Connect Stripe →
          </a>
        </div>
      )}

      {/* Questions table */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Your questions</h2>
        {questions.length === 0 ? (
          <p className="text-sm text-slate-400">No questions yet. Start writing!</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-500">Chapter</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Difficulty</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Impressions</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {questions.map((q) => (
                  <tr key={q.id} className="align-top">
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                      <p>{q.chapter.name}</p>
                      <p className="text-[10px] text-slate-400">{q.subject.curriculum.code} · {q.subject.name}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{q.difficulty}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CHIP[q.status] ?? ""}`}>
                        {STATUS_LABEL[q.status] ?? q.status}
                      </span>
                      {q.status === "DRAFT" && q.lastReviewNote && (
                        <p className="mt-1 max-w-xs text-[10px] text-rose-600 dark:text-rose-400">
                          <span className="font-bold uppercase tracking-widest">Returned:</span> {q.lastReviewNote}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{q._count.attempts}</td>
                    <td className="px-4 py-3 text-slate-400">{fmt(q.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Payout history */}
      {payouts.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Payout history</h2>
          <div className="space-y-2">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{usd(p.amountCents)}</p>
                  <p className="text-[10px] text-slate-400">{fmt(p.periodStart)} – {fmt(p.periodEnd)}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  p.status === "PAID" ? "bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400"
                  : p.status === "FAILED" ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                  : "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                }`}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
