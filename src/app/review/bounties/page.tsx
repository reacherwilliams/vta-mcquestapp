import "server-only"
import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ReviewBountiesClient } from "./ReviewBountiesClient"

export const metadata = { title: "Manage bounties" }

export default async function ReviewBountiesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id
  const role = session.user.role as string
  const isPlatformAdmin = role === "ADMIN" || role === "SUPER_ADMIN"

  // Which curricula can this user post bounties for? Admins: all. Otherwise:
  // only curricula they hold a CURRICULUM ReviewerAssignment for.
  const curricula = isPlatformAdmin
    ? await prisma.curriculum.findMany({
        where: { isActive: true },
        select: { id: true, code: true, displayName: true },
        orderBy: { sortOrder: "asc" },
      })
    : await prisma.curriculum.findMany({
        where: {
          isActive: true,
          reviewerAssignments: { some: { userId, scope: "CURRICULUM" } },
        },
        select: { id: true, code: true, displayName: true },
        orderBy: { sortOrder: "asc" },
      })

  if (curricula.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">No curricula to manage</h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Only curriculum reviewers (and admins) can post bounties. You haven&apos;t been assigned to any curriculum yet.
        </p>
        <Link href="/review" className="mt-6 inline-block text-sm font-semibold text-lime-700 hover:underline dark:text-lime-400">
          ← Back to review queue
        </Link>
      </div>
    )
  }

  const curriculumIds = curricula.map((c) => c.id)
  const subjects = await prisma.subject.findMany({
    where: { curriculumId: { in: curriculumIds }, isActive: true },
    select: { id: true, name: true, code: true, curriculumId: true },
    orderBy: [{ curriculumId: "asc" }, { name: "asc" }],
  })

  const chapters = await prisma.chapter.findMany({
    where: { subjectId: { in: subjects.map((s) => s.id) }, isActive: true },
    select: { id: true, name: true, subjectId: true },
    orderBy: { name: "asc" },
  })

  // List bounties — for admins, all; for curriculum reviewers, just their curricula.
  const bounties = await prisma.bounty.findMany({
    where: { curriculumId: { in: curriculumIds } },
    include: {
      curriculum: { select: { code: true } },
      subject:    { select: { name: true } },
      chapter:    { select: { name: true } },
      claimedBy:  { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  })

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Bounties</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Post a needs list so contributors fill gaps instead of duplicating each other.
          </p>
        </div>
        <Link href="/review" className="text-sm font-semibold text-lime-700 hover:underline dark:text-lime-400">
          ← Review queue
        </Link>
      </div>

      <ReviewBountiesClient
        curricula={curricula}
        subjects={subjects}
        chapters={chapters}
        bounties={bounties}
      />
    </div>
  )
}
