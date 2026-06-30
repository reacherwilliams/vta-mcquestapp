import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFounderTier } from "@/lib/permissions"
import { writeAudit } from "@/lib/audit"

// Revoke a single enrollment (hard delete — the student loses access immediately).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!isFounderTier(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.enrollment.findUnique({
    where: { id },
    select: { userId: true, subjectId: true },
  })
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 })

  await prisma.enrollment.delete({ where: { id } })
  writeAudit(session!.user!.id, "ENROLLMENT_REVOKED", "User", existing.userId, { subjectId: existing.subjectId })
  return new NextResponse(null, { status: 204 })
}
