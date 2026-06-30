import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { canViewFinance, canManageFinance } from "@/lib/permissions"
import { getProfitShare, setProfitShare, type ProfitShareConfig } from "@/lib/finance"
import { writeAudit } from "@/lib/audit"

// Profit-distribution split. Founders view; only SUPER_ADMIN edits.
export async function GET() {
  const session = await auth()
  if (!canViewFinance(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }
  return NextResponse.json(await getProfitShare())
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!canManageFinance(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  let body: ProfitShareConfig
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }
  if (!Array.isArray(body.beneficiaries) || !body.beneficiaries.length) {
    return NextResponse.json({ error: "At least one beneficiary is required." }, { status: 400 })
  }

  try {
    await setProfitShare(body, session!.user!.id)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
  const saved = await getProfitShare()
  writeAudit(session!.user!.id, "PROFIT_SHARE_UPDATED", "PlatformSetting", "profit_share", saved)
  return NextResponse.json(saved)
}
