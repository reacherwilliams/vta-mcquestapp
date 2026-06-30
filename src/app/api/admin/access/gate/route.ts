import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { canManageFinance } from "@/lib/permissions"
import { getEntitlementGate, setEntitlementGate, type EntitlementGate } from "@/lib/entitlements"
import { writeAudit } from "@/lib/audit"

// Super Admin / founder control over the entitlement gate (master switch).
export async function GET() {
  const session = await auth()
  if (!canManageFinance(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }
  return NextResponse.json(await getEntitlementGate())
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!canManageFinance(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  let body: Partial<EntitlementGate>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  const gate: EntitlementGate = {
    enabled: !!body.enabled,
    enforceFrom: body.enforceFrom ? new Date(body.enforceFrom).toISOString() : null,
  }

  await setEntitlementGate(gate, session!.user!.id)
  writeAudit(session!.user!.id, "ENTITLEMENT_GATE_UPDATED", "PlatformSetting", "entitlement_gate", gate)
  return NextResponse.json(gate)
}
