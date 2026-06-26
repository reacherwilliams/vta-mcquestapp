import "server-only"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageTeam } from "@/lib/permissions"
import { PlatformTeamClient } from "./PlatformTeamClient"

export const metadata = { title: "Admin — Platform Team" }

export default async function PlatformTeamPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canManageTeam(session.user.role)) redirect("/admin")

  // Pull all team members (anyone who is NOT a plain STUDENT) — admins, contributors,
  // and SAs. Reviewer status is layered on top via ReviewerAssignment.
  const [team, reviewerAssignments] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "CO_FOUNDER", "ADMIN", "CONTRIBUTOR"] } },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        role: true, status: true, lastLoginAt: true, createdAt: true,
        _count: { select: { questionsAuthored: true, questionReviews: true } },
      },
      orderBy: [{ role: "asc" }, { firstName: "asc" }],
    }),
    prisma.reviewerAssignment.findMany({
      include: {
        subject:    { select: { id: true, name: true, curriculum: { select: { code: true } } } },
        curriculum: { select: { id: true, code: true, displayName: true } },
      },
    }),
  ])

  // Pivot reviewer assignments by userId for the client.
  const byUser: Record<string, {
    subjects: { id: string; name: string; curriculumCode: string }[]
    curricula: { id: string; code: string; displayName: string }[]
    assignmentIds: { subject: Record<string, string>; curriculum: Record<string, string> }
  }> = {}

  for (const a of reviewerAssignments) {
    const entry = (byUser[a.userId] ??= {
      subjects: [], curricula: [],
      assignmentIds: { subject: {}, curriculum: {} },
    })
    if (a.scope === "SUBJECT" && a.subject) {
      entry.subjects.push({
        id: a.subject.id,
        name: `${a.subject.curriculum.code} — ${a.subject.name}`,
        curriculumCode: a.subject.curriculum.code,
      })
      entry.assignmentIds.subject[a.subject.id] = a.id
    }
    if (a.scope === "CURRICULUM" && a.curriculum) {
      entry.curricula.push({
        id: a.curriculum.id,
        code: a.curriculum.code,
        displayName: a.curriculum.displayName,
      })
      entry.assignmentIds.curriculum[a.curriculum.id] = a.id
    }
  }

  // Source data for the reviewer-assign picker on each row.
  const [allCurricula, allSubjects] = await Promise.all([
    prisma.curriculum.findMany({
      where: { isActive: true },
      select: { id: true, code: true, displayName: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.subject.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true,
        curriculum: { select: { id: true, code: true } },
      },
      orderBy: [{ curriculum: { sortOrder: "asc" } }, { name: "asc" }],
    }),
  ])

  return (
    <PlatformTeamClient
      team={team.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        status: u.status,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        questionCount: u._count.questionsAuthored,
        reviewCount: u._count.questionReviews,
        reviewer: byUser[u.id] ?? null,
      }))}
      curricula={allCurricula}
      subjects={allSubjects.map((s) => ({
        id: s.id, name: s.name,
        curriculumId: s.curriculum.id,
        curriculumCode: s.curriculum.code,
      }))}
      viewerRole={session.user.role}
    />
  )
}
