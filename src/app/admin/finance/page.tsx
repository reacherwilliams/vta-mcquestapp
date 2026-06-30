import "server-only"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { canViewFinance, canManageFinance } from "@/lib/permissions"
import { getMonthlyFinance, getProfitShare, computeDistribution } from "@/lib/finance"
import { FinanceClient } from "./FinanceClient"

export const metadata = { title: "Admin — Finance" }

type SearchParams = Promise<{ month?: string }>

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  // Founders can view (read-only); only SUPER_ADMIN can record/delete expenses.
  if (!canViewFinance(session.user.role)) redirect("/admin")

  const { month } = await searchParams
  const fin = await getMonthlyFinance(month, new Date())
  const profitShare = await getProfitShare()
  const distribution = computeDistribution(fin.netCents, profitShare)

  return (
    <FinanceClient
      canManage={canManageFinance(session.user.role)}
      profitShare={profitShare}
      distribution={distribution}
      range={{ key: fin.range.key, label: fin.range.label, prevKey: fin.range.prevKey, nextKey: fin.range.nextKey, isCurrent: fin.range.isCurrent, isFuture: fin.range.isFuture }}
      currency={fin.income.currency}
      incomeCents={fin.incomeCents}
      incomeIsProjected={fin.incomeIsProjected}
      actualAvailable={fin.income.actualCents !== null}
      expenses={{
        totalCents: fin.expenses.totalCents,
        payoutCents: fin.expenses.payoutCents,
        byCategory: fin.expenses.byCategory,
        items: fin.expenses.items.map((e) => ({
          id: e.id,
          category: e.category,
          amountCents: e.amountCents,
          currency: e.currency,
          incurredOn: e.incurredOn.toISOString(),
          note: e.note,
          recordedBy: e.recordedBy ? `${e.recordedBy.firstName} ${e.recordedBy.lastName}` : null,
        })),
      }}
      netCents={fin.netCents}
    />
  )
}
