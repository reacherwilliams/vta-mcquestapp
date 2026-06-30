import "server-only"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { canManageFinance } from "@/lib/permissions"
import { getEntitlementGate, getTrialDays, getPricingConfig } from "@/lib/entitlements"
import { AccessClient } from "./AccessClient"

export const metadata = { title: "Admin — Access & Entitlements" }

export default async function AccessPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  // SUPER_ADMIN only — co-founders see monetization on the dashboard, not this.
  if (!canManageFinance(session.user.role)) redirect("/admin")

  const [gate, trialDays, pricing] = await Promise.all([getEntitlementGate(), getTrialDays(), getPricingConfig()])

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">Access &amp; entitlements</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Control per-subject student access. The gate is off by default — when on, students can only practise
          subjects they&apos;re enrolled in (admins are always exempt).
        </p>
      </header>
      <AccessClient initialGate={gate} initialTrialDays={trialDays} initialPricing={pricing} />
    </div>
  )
}
