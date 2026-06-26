import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"

function isAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

// DELETE /api/admin/reviewers/[id] — revoke a reviewer assignment.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.reviewerAssignment.findUnique({
    where: { id },
    select: { userId: true, scope: true, subjectId: true, curriculumId: true },
  })
  if (!existing) return NextResponse.json({ error: "Assignment not found." }, { status: 404 })

  await prisma.reviewerAssignment.delete({ where: { id } })

  writeAudit(session!.user!.id, "USER_ROLE_CHANGED", "ReviewerAssignment", id, {
    assignedUserId: existing.userId,
    scope: existing.scope,
    subjectId: existing.subjectId,
    curriculumId: existing.curriculumId,
    action: "delete",
  })

  return NextResponse.json({ deleted: true })
}
