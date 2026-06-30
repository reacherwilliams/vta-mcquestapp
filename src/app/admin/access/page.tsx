import "server-only"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isFounderTier } from "@/lib/permissions"
import { getEntitlementGate, getTrialDays } from "@/lib/entitlements"
import { AccessClient } from "./AccessClient"

export const metadata = { title: "Admin — Access & Entitlements" }

export default async function AccessPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!isFounderTier(session.user.role)) redirect("/admin")

  const [gate, trialDays] = await Promise.all([getEntitlementGate(), getTrialDays()])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">Access &amp; entitlements</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Control per-subject student access. The gate is off by default — when on, students can only practise
          subjects they&apos;re enrolled in (admins are always exempt).
        </p>
      </header>
      <AccessClient initialGate={gate} initialTrialDays={trialDays} />
    </div>
  )
}
