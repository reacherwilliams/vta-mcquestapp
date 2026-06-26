import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminTier } from "@/lib/permissions"
import { ReviewQueueClient } from "./ReviewQueueClient"

export const metadata = { title: "Reviewer queue" }

export default async function ReviewQueuePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id
  const role = session.user.role as string

  // Admin tier (incl. CO_FOUNDER) gets full review-queue oversight: implicit
  // reviewer at every tier, sees the entire queue without explicit assignments.
  const isAdmin = isAdminTier(role)

  // Load this user's reviewer assignments. Admins are implicit reviewers at every tier.
  const assignments = await prisma.reviewerAssignment.findMany({
    where: { userId },
    select: { id: true, scope: true, subjectId: true, curriculumId: true },
  })

  if (assignments.length === 0 && !isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">No reviewer assignments yet</h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          You haven&apos;t been assigned as a reviewer for any subject or curriculum. Once an admin assigns you, questions awaiting your review will appear here.
        </p>
        <Link href="/practice" className="mt-6 inline-block text-sm font-semibold text-lime-700 hover:underline dark:text-lime-400">
          ← Back to app
        </Link>
      </div>
    )
  }

  // Scope the queue:
  //   IN_SUBJECT_REVIEW + subjectId ∈ assigned-subjects
  //   IN_CURRICULUM_REVIEW + curriculumId ∈ assigned-curricula
  // Admins see everything.
  const subjectIds    = assignments.filter((a) => a.scope === "SUBJECT").map((a) => a.subjectId!).filter(Boolean)
  const curriculumIds = assignments.filter((a) => a.scope === "CURRICULUM").map((a) => a.curriculumId!).filter(Boolean)

  const queue = await prisma.question.findMany({
    where: isAdmin
      ? { status: { in: ["IN_SUBJECT_REVIEW", "IN_CURRICULUM_REVIEW"] } }
      : {
          OR: [
            { status: "IN_SUBJECT_REVIEW", subjectId: { in: subjectIds } },
            { status: "IN_CURRICULUM_REVIEW", subject: { curriculumId: { in: curriculumIds } } },
          ],
        },
    select: {
      id: true, status: true, difficulty: true, year: true, tags: true,
      stem: true, explanation: true, allowMultipleCorrect: true, authorId: true,
      lastReviewNote: true,
      subject: { select: { id: true, name: true, code: true, curriculum: { select: { id: true, code: true, displayName: true } } } },
      chapter: { select: { name: true } },
      unit:    { select: { name: true } },
      author:  { select: { firstName: true, lastName: true, email: true } },
      options: { select: { id: true, content: true, isCorrect: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { updatedAt: "asc" },  // oldest first — fairer to authors
    take: 100,
  })

  // For reassign dropdown: who else is a reviewer at the SAME tier as each question?
  // Pre-compute a map: { subjectId -> [users] } and { curriculumId -> [users] }
  const allAssignments = await prisma.reviewerAssignment.findMany({
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  })

  const subjectReviewers: Record<string, { id: string; firstName: string; lastName: string }[]> = {}
  const curriculumReviewers: Record<string, { id: string; firstName: string; lastName: string }[]> = {}
  for (const a of allAssignments) {
    if (a.scope === "SUBJECT" && a.subjectId) {
      (subjectReviewers[a.subjectId] ??= []).push(a.user)
    }
    if (a.scope === "CURRICULUM" && a.curriculumId) {
      (curriculumReviewers[a.curriculumId] ??= []).push(a.user)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Review queue</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {queue.length === 0
              ? "All caught up — nothing awaiting your review."
              : `${queue.length} question${queue.length === 1 ? "" : "s"} awaiting decision.`}
          </p>
        </div>
        <Link
          href="/review/bounties"
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Bounties →
        </Link>
      </div>

      <ReviewQueueClient
        currentUserId={userId}
        queue={queue}
        subjectReviewers={subjectReviewers}
        curriculumReviewers={curriculumReviewers}
      />
    </div>
  )
}
