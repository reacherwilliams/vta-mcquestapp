import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"

type RouteCtx = { params: Promise<{ id: string }> }

// POST /api/bounties/[id]/release
// Auth: the current claimant, or ADMIN/SUPER_ADMIN.
// Drops the claim and returns the bounty to OPEN (unless already terminal).
export async function POST(_req: Request, { params }: RouteCtx) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 })
  }
  const role = session.user.role
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"

  const { id } = await params
  const bounty = await prisma.bounty.findUnique({
    where: { id },
    select: { id: true, status: true, claimedById: true },
  })
  if (!bounty) return NextResponse.json({ error: "Not found." }, { status: 404 })

  if (bounty.status !== "CLAIMED") {
    return NextResponse.json({ error: "Bounty is not currently claimed." }, { status: 400 })
  }
  if (!isAdmin && bounty.claimedById !== session.user.id) {
    return NextResponse.json({ error: "Only the current claimant can release this bounty." }, { status: 403 })
  }

  const updated = await prisma.bounty.update({
    where: { id },
    data: {
      status: "OPEN",
      claimedById: null,
      claimedAt: null,
      claimExpiresAt: null,
    },
  })

  writeAudit(session.user.id, "BOUNTY_RELEASED", "Bounty", id, {
    previousClaimantId: bounty.claimedById,
  })

  return NextResponse.json(updated)
}
