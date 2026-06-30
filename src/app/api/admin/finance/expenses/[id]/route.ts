import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageFinance } from "@/lib/permissions"
import { writeAudit } from "@/lib/audit"

// Delete an expense entry — SUPER_ADMIN only.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!canManageFinance(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }
  const { id } = await params
  const existing = await prisma.expense.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 })

  await prisma.expense.delete({ where: { id } })
  writeAudit(session!.user!.id, "EXPENSE_DELETED", "Expense", id, {})
  return new NextResponse(null, { status: 204 })
}
