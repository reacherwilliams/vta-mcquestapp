import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canViewFinance, canManageFinance } from "@/lib/permissions"

// $0.001 per impression (0.1 cents) — adjust as needed
const CENTS_PER_IMPRESSION = 0.1

// Finance is tiered: founders (SA + co-founder) may VIEW payouts; only a
// SUPER_ADMIN may MOVE MONEY (generate payouts, mark them paid).
async function assertFinanceView() {
  const session = await auth()
  if (!session?.user?.id) return null
  return canViewFinance(session.user.role) ? session.user.id : null
}

async function assertFinanceManage() {
  const session = await auth()
  if (!session?.user?.id) return null
  return canManageFinance(session.user.role) ? session.user.id : null
}

export async function GET() {
  if (!await assertFinanceView()) return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  const payouts = await prisma.contributorPayout.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      amountCents: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      stripeTransferId: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true, stripeConnectId: true } },
    },
  })
  return NextResponse.json(payouts)
}

export async function POST(req: Request) {
  if (!await assertFinanceManage()) return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  let body: { periodStart: string; periodEnd: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  const periodStart = new Date(body.periodStart)
  const periodEnd = new Date(body.periodEnd)

  // Find all published questions with an authorId and their attempt counts in the period
  const attempts = await prisma.attempt.groupBy({
    by: ["questionId"],
    where: { createdAt: { gte: periodStart, lt: periodEnd } },
    _count: { questionId: true },
  })

  // Map questionId → impressions
  const impressionMap = new Map(attempts.map((a) => [a.questionId, a._count.questionId]))

  // Find published questions with authors
  const questions = await prisma.question.findMany({
    where: {
      authorId: { not: null },
      status: "PUBLISHED",
      id: { in: [...impressionMap.keys()] },
    },
    select: { authorId: true, id: true },
  })

  // Aggregate by author
  const authorEarnings = new Map<string, number>()
  for (const q of questions) {
    if (!q.authorId) continue
    const impressions = impressionMap.get(q.id) ?? 0
    const prev = authorEarnings.get(q.authorId) ?? 0
    authorEarnings.set(q.authorId, prev + impressions)
  }

  // Create payout records
  const created = await Promise.all(
    [...authorEarnings.entries()].map(([userId, impressions]) =>
      prisma.contributorPayout.create({
        data: {
          userId,
          amountCents: Math.round(impressions * CENTS_PER_IMPRESSION),
          periodStart,
          periodEnd,
          status: "PENDING",
        },
      }),
    ),
  )

  return NextResponse.json({ created: created.length }, { status: 201 })
}

export async function PATCH(req: Request) {
  if (!await assertFinanceManage()) return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  let body: { id: string; status: string; stripeTransferId?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  await prisma.contributorPayout.update({
    where: { id: body.id },
    data: { status: body.status, stripeTransferId: body.stripeTransferId ?? undefined },
  })
  return NextResponse.json({ updated: true })
}
