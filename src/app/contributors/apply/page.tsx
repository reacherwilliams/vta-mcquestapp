import "server-only"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ApplyClient } from "./ApplyClient"

export const metadata = { title: "Become a Contributor" }

export default async function ApplyPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, firstName: true },
  })

  if (user?.role === "CONTRIBUTOR" || user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
    redirect("/contributors/dashboard")
  }

  const existing = await prisma.contributorApplication.findUnique({
    where: { userId: session.user.id },
    select: { status: true, notes: true, createdAt: true },
  })

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/practice" className="text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
        ← Practice
      </Link>

      <div className="mt-6 mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Become a Contributor</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Write exam-style questions, get reviewed by peers, and earn revenue share based on impressions.
        </p>
      </div>

      {existing ? (
        <div className={`rounded-2xl border p-6 ${
          existing.status === "APPROVED"
            ? "border-lime-400 bg-lime-50 dark:border-lime-700 dark:bg-lime-950/20"
            : existing.status === "REJECTED"
            ? "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/20"
            : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
        }`}>
          <p className={`text-sm font-semibold ${
            existing.status === "APPROVED" ? "text-lime-700 dark:text-lime-400"
            : existing.status === "REJECTED" ? "text-rose-600 dark:text-rose-400"
            : "text-amber-700 dark:text-amber-400"
          }`}>
            Application {existing.status === "PENDING" ? "under review" : existing.status.toLowerCase()}
          </p>
          {existing.notes && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{existing.notes}</p>
          )}
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Submitted {new Date(existing.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>
      ) : (
        <>
          {/* What you get */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { icon: "✍️", title: "Write questions", body: "Author exam-style MCQs with explanations and difficulty ratings." },
              { icon: "👥", title: "Peer reviewed", body: "Two approved contributors review each question before it goes live." },
              { icon: "💰", title: "Earn revenue", body: "$0.001 per impression on your published questions, paid monthly." },
            ].map(({ icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-2xl">{icon}</p>
                <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          <ApplyClient firstName={user?.firstName ?? ""} />
        </>
      )}
    </div>
  )
}
