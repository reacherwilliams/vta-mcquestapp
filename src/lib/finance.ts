import "server-only"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe/client"
import { getPricingConfig } from "@/lib/entitlements"
import { computeSubjectPrice } from "@/lib/pricing"

// ─── Finance / monthly P&L ────────────────────────────────────────────────────
// Income source of truth is Stripe (actual paid invoices). When Stripe isn't
// configured / has no data (e.g. before billing goes live), the CURRENT month
// falls back to a projection from active paid subscriptions, clearly flagged.
// Expenses = the manual Expense ledger + contributor payouts (their own system).

export type MonthRange = {
  key: string        // "2026-07"
  label: string      // "July 2026"
  start: Date        // inclusive (UTC month start)
  end: Date          // exclusive (next UTC month start)
  prevKey: string
  nextKey: string
  isCurrent: boolean
  isFuture: boolean
}

/** Resolve a "YYYY-MM" (or undefined → current) into a UTC month range. */
export function monthRange(month: string | undefined, now: Date): MonthRange {
  const valid = month && /^\d{4}-\d{2}$/.test(month)
  const y = valid ? Number(month!.slice(0, 4)) : now.getUTCFullYear()
  const m = valid ? Number(month!.slice(5, 7)) - 1 : now.getUTCMonth()
  const start = new Date(Date.UTC(y, m, 1))
  const end = new Date(Date.UTC(y, m + 1, 1))
  const prev = new Date(Date.UTC(y, m - 1, 1))
  const next = new Date(Date.UTC(y, m + 1, 1))
  const fmtKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
  const curKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
  const key = fmtKey(start)
  return {
    key,
    label: start.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    start, end,
    prevKey: fmtKey(prev),
    nextKey: fmtKey(next),
    isCurrent: key === curKey,
    isFuture: start > now,
  }
}

export type MonthlyIncome = { actualCents: number | null; projectedCents: number; currency: string }

export async function getMonthlyIncome(start: Date, end: Date, isCurrent: boolean): Promise<MonthlyIncome> {
  const pricing = await getPricingConfig()

  // Projection (current month only): snapshot of active paid subscriptions.
  let projectedCents = 0
  if (isCurrent) {
    const paidByUser = await prisma.enrollment.groupBy({
      by: ["userId"], where: { source: "PAID", status: "ACTIVE" }, _count: { _all: true },
    })
    projectedCents = paidByUser.reduce((s, u) => s + computeSubjectPrice(pricing, u._count._all, "monthly").totalCents, 0)
  }

  // Actual: Stripe paid invoices in the window (auto-paginates). Null on any
  // failure (no key / network) so the UI can fall back to the projection.
  let actualCents: number | null = null
  try {
    let total = 0
    const gte = Math.floor(start.getTime() / 1000)
    const lt = Math.floor(end.getTime() / 1000)
    for await (const inv of stripe.invoices.list({ created: { gte, lt }, status: "paid", limit: 100 })) {
      total += inv.amount_paid ?? 0
    }
    actualCents = total
  } catch {
    actualCents = null
  }

  return { actualCents, projectedCents, currency: pricing.currency }
}

export type ExpenseRow = {
  id: string
  category: string
  amountCents: number
  currency: string
  incurredOn: Date
  note: string | null
  recordedBy: { firstName: string; lastName: string } | null
}
export type MonthlyExpenses = {
  items: ExpenseRow[]
  byCategory: { category: string; cents: number }[]
  payoutCents: number
  totalCents: number
}

export async function getMonthlyExpenses(start: Date, end: Date): Promise<MonthlyExpenses> {
  const [expenses, payout] = await Promise.all([
    prisma.expense.findMany({
      where: { incurredOn: { gte: start, lt: end } },
      orderBy: { incurredOn: "desc" },
      include: { recordedBy: { select: { firstName: true, lastName: true } } },
    }),
    prisma.contributorPayout.aggregate({
      where: { createdAt: { gte: start, lt: end }, status: { not: "PENDING" } },
      _sum: { amountCents: true },
    }),
  ])

  const payoutCents = payout._sum.amountCents ?? 0
  const byCat = new Map<string, number>()
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amountCents)
  if (payoutCents > 0) byCat.set("CONTRIBUTOR_PAYOUT", payoutCents)

  const totalCents = expenses.reduce((s, e) => s + e.amountCents, 0) + payoutCents
  return {
    items: expenses,
    byCategory: [...byCat.entries()].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents),
    payoutCents,
    totalCents,
  }
}

export type MonthlyFinance = {
  range: MonthRange
  income: MonthlyIncome
  expenses: MonthlyExpenses
  incomeCents: number
  incomeIsProjected: boolean
  netCents: number
}

// ─── Profit distribution ──────────────────────────────────────────────────────
// Net profit is split among beneficiaries by configurable percentages. Personal
// beneficiaries carry an `email` so each founder can see their own share on the
// dashboard. SA-editable; founders view.

const PROFIT_SHARE_KEY = "profit_share"

export type ProfitBeneficiary = { label: string; pct: number; email: string | null }
export type ProfitShareConfig = { beneficiaries: ProfitBeneficiary[] }

const DEFAULT_PROFIT_SHARE: ProfitShareConfig = {
  beneficiaries: [
    { label: "Reacher Williams", pct: 30, email: "reacher.williams@mcq-masterloop.com" },
    { label: "Jayesh Patole", pct: 30, email: "jayesh.patole@mcq-masterloop.com" },
    { label: "VantageTech Apps, LLC", pct: 30, email: null },
    { label: "Ministry / Tithe", pct: 10, email: null },
  ],
}

export async function getProfitShare(): Promise<ProfitShareConfig> {
  const row = await prisma.platformSetting.findUnique({ where: { key: PROFIT_SHARE_KEY } })
  const v = row?.value as ProfitShareConfig | undefined
  if (!v?.beneficiaries?.length) return DEFAULT_PROFIT_SHARE
  return v
}

export async function setProfitShare(config: ProfitShareConfig, updatedById?: string): Promise<void> {
  const beneficiaries = (config.beneficiaries ?? [])
    .filter((b) => b.label?.trim() && Number.isFinite(b.pct) && b.pct >= 0)
    .map((b) => ({ label: b.label.trim(), pct: Math.round(b.pct * 100) / 100, email: b.email?.trim().toLowerCase() || null }))
  if (!beneficiaries.length) throw new Error("At least one beneficiary is required.")
  await prisma.platformSetting.upsert({
    where: { key: PROFIT_SHARE_KEY },
    create: { key: PROFIT_SHARE_KEY, value: { beneficiaries }, updatedById: updatedById ?? null },
    update: { value: { beneficiaries }, updatedById: updatedById ?? null },
  })
}

export type Distribution = {
  distributableCents: number          // max(0, net) — nothing to split on a loss
  totalPct: number                    // should be 100; surfaced so SA can spot a misconfig
  shares: { label: string; pct: number; email: string | null; cents: number }[]
}

/** Split net profit across the configured beneficiaries (no distribution on a loss). */
export function computeDistribution(netCents: number, config: ProfitShareConfig): Distribution {
  const distributableCents = Math.max(0, netCents)
  const totalPct = config.beneficiaries.reduce((s, b) => s + b.pct, 0)
  const shares = config.beneficiaries.map((b) => ({
    label: b.label,
    pct: b.pct,
    email: b.email,
    cents: Math.round((distributableCents * b.pct) / 100),
  }))
  return { distributableCents, totalPct, shares }
}

/** Full monthly P&L: income (actual or projected) − expenses = net. */
export async function getMonthlyFinance(month: string | undefined, now: Date): Promise<MonthlyFinance> {
  const range = monthRange(month, now)
  const [income, expenses] = await Promise.all([
    getMonthlyIncome(range.start, range.end, range.isCurrent),
    getMonthlyExpenses(range.start, range.end),
  ])
  const incomeCents = income.actualCents ?? (range.isCurrent ? income.projectedCents : 0)
  const incomeIsProjected = income.actualCents === null
  return { range, income, expenses, incomeCents, incomeIsProjected, netCents: incomeCents - expenses.totalCents }
}
