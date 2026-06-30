import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { canManageFinance } from "@/lib/permissions"
import { getPricingConfig, setPricingConfig } from "@/lib/entitlements"
import type { PricingConfig } from "@/lib/pricing"
import { writeAudit } from "@/lib/audit"

// SA / founder control over the per-subject volume pricing shown on-site.
// NOTE: this must mirror the Stripe Price's volume tiers — it drives the
// estimate, not the charge.
export async function GET() {
  const session = await auth()
  if (!canManageFinance(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }
  return NextResponse.json(await getPricingConfig())
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!canManageFinance(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  let body: PricingConfig
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }
  if (!Array.isArray(body.tiers) || !body.tiers.length) {
    return NextResponse.json({ error: "At least one price tier is required." }, { status: 400 })
  }

  await setPricingConfig(body, session!.user!.id)
  const saved = await getPricingConfig()
  writeAudit(session!.user!.id, "ENTITLEMENT_PRICING_UPDATED", "PlatformSetting", "entitlement_pricing", saved)
  return NextResponse.json(saved)
}
