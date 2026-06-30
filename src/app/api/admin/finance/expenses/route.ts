import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canViewFinance, canManageFinance } from "@/lib/permissions"
import { monthRange } from "@/lib/finance"
import { writeAudit } from "@/lib/audit"

const CATEGORIES = ["PLATFORM", "SALARY", "MARKETING", "TAX", "REFUND", "OTHER"] as const

// List expenses for a month (founders can view).
export async function GET(req: Request) {
  const session = await auth()
  if (!canViewFinance(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }
  const month = new URL(req.url).searchParams.get("month") ?? undefined
  const { start, end } = monthRange(month, new Date())
  const items = await prisma.expense.findMany({
    where: { incurredOn: { gte: start, lt: end } },
    orderBy: { incurredOn: "desc" },
    include: { recordedBy: { select: { firstName: true, lastName: true } } },
  })
  return NextResponse.json(items)
}

// Record an expense — SUPER_ADMIN only.
export async function POST(req: Request) {
  const session = await auth()
  if (!canManageFinance(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  let body: { category?: string; amountCents?: number; currency?: string; incurredOn?: string; note?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  const category = (body.category ?? "OTHER").toUpperCase()
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 })
  }
  const amountCents = Math.round(Number(body.amountCents))
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "amountCents must be a positive number." }, { status: 400 })
  }
  const incurredOn = body.incurredOn ? new Date(body.incurredOn) : new Date()
  if (Number.isNaN(incurredOn.getTime())) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 })
  }

  const expense = await prisma.expense.create({
    data: {
      category: category as (typeof CATEGORIES)[number],
      amountCents,
      currency: (body.currency ?? "usd").toLowerCase(),
      incurredOn,
      note: body.note?.trim() || null,
      recordedById: session!.user!.id,
    },
  })

  writeAudit(session!.user!.id, "EXPENSE_RECORDED", "Expense", expense.id, { category, amountCents, incurredOn })
  return NextResponse.json(expense, { status: 201 })
}
