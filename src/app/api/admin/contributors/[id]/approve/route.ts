import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminTier } from "@/lib/permissions"

async function assertAdmin() {
  const session = await auth()
  if (!session?.user?.id) return null
  return isAdminTier(session.user.role) ? session.user.id : null
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await assertAdmin()
  if (!adminId) return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  const { id } = await params
  let body: { decision: "APPROVED" | "REJECTED"; notes?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  if (body.decision !== "APPROVED" && body.decision !== "REJECTED") {
    return NextResponse.json({ error: "decision must be APPROVED or REJECTED." }, { status: 400 })
  }

  const app = await prisma.contributorApplication.update({
    where: { id },
    data: { status: body.decision, notes: body.notes?.trim() ?? null },
    select: { userId: true },
  })

  if (body.decision === "APPROVED") {
    await prisma.user.update({
      where: { id: app.userId },
      data: { role: "CONTRIBUTOR" },
    })
  }

  return NextResponse.json({ updated: true })
}
