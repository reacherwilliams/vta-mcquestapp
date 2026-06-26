import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import { isEffectivelyOpen, CLAIM_HOLD_MS } from "@/lib/bounties"

type RouteCtx = { params: Promise<{ id: string }> }

// POST /api/bounties/[id]/claim
// Auth: any signed-in user with role CONTRIBUTOR | ADMIN | SUPER_ADMIN
// (we don't gate on contributors-only because admins may want to claim too).
export async function POST(_req: Request, { params }: RouteCtx) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 })
  }
  const role = session.user.role
  if (role !== "CONTRIBUTOR" && role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "CO_FOUNDER") {
    return NextResponse.json({ error: "Only contributors and admins can claim bounties." }, { status: 403 })
  }

  const { id } = await params
  const bounty = await prisma.bounty.findUnique({
    where: { id },
    select: { id: true, status: true, claimedById: true, claimExpiresAt: true, count: true, filledCount: true },
  })
  if (!bounty) return NextResponse.json({ error: "Not found." }, { status: 404 })

  if (bounty.status === "FULFILLED" || bounty.status === "CLOSED") {
    return NextResponse.json({ error: `Bounty is ${bounty.status.toLowerCase()} — cannot claim.` }, { status: 400 })
  }

  // If currently CLAIMED but the hold has expired, anyone can take it.
  if (!isEffectivelyOpen(bounty)) {
    return NextResponse.json({ error: "Bounty is already claimed by another contributor." }, { status: 409 })
  }

  // Optimistic update — guard against concurrent claims with the WHERE clause:
  // only proceed if status is OPEN, OR currently CLAIMED with an expired hold.
  const now = new Date()
  const expires = new Date(now.getTime() + CLAIM_HOLD_MS)

  const updated = await prisma.bounty.updateMany({
    where: {
      id,
      status: { in: ["OPEN", "CLAIMED"] },
      OR: [
        { status: "OPEN" },
        { claimExpiresAt: { lt: now } },
      ],
    },
    data: {
      status: "CLAIMED",
      claimedById: session.user.id,
      claimedAt: now,
      claimExpiresAt: expires,
    },
  })

  if (updated.count === 0) {
    return NextResponse.json({ error: "Could not claim — someone beat you to it." }, { status: 409 })
  }

  writeAudit(session.user.id, "BOUNTY_CLAIMED", "Bounty", id, { expiresAt: expires })

  const fresh = await prisma.bounty.findUnique({ where: { id } })
  return NextResponse.json(fresh)
}
