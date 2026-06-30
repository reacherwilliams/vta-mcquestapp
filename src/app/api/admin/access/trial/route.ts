import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isFounderTier } from "@/lib/permissions"
import { getTrialDays, setTrialDays } from "@/lib/entitlements"
import { writeAudit } from "@/lib/audit"

// SA / founder control over the free-trial length (days).
export async function GET() {
  const session = await auth()
  if (!isFounderTier(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }
  return NextResponse.json({ days: await getTrialDays() })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!isFounderTier(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  let body: { days?: number }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }
  if (typeof body.days !== "number" || body.days < 1) {
    return NextResponse.json({ error: "days must be a positive number." }, { status: 400 })
  }

  await setTrialDays(body.days, session!.user!.id)
  const days = await getTrialDays()
  writeAudit(session!.user!.id, "ENTITLEMENT_TRIAL_UPDATED", "PlatformSetting", "entitlement_trial", { days })
  return NextResponse.json({ days })
}
