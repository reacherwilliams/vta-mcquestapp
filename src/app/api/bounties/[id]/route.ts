import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import { canManageBounty, BountyError } from "@/lib/bounties"
import type { QuestionDifficulty, UserRole } from "@prisma/client"

type RouteCtx = { params: Promise<{ id: string }> }

function isPlatformAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

// PATCH /api/bounties/[id]
//   - edit scope (count, notes, status, etc.)
//   - status transitions: OPEN ↔ CLOSED (manual close/reopen)
export async function PATCH(req: Request, { params }: RouteCtx) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 })
  }
  const actor = { id: session.user.id, role: session.user.role as UserRole }

  const { id } = await params
  const bounty = await prisma.bounty.findUnique({
    where: { id }, select: { id: true, curriculumId: true, status: true, filledCount: true },
  })
  if (!bounty) return NextResponse.json({ error: "Not found." }, { status: 404 })

  try {
    if (!(await canManageBounty(actor, bounty.curriculumId))) {
      throw new BountyError("Forbidden — you do not manage this curriculum.", 403)
    }

    const body = await req.json()
    const { count, notes, difficulty, year, chapterId, status: newStatus } = body

    if (difficulty && !["EASY", "MEDIUM", "HARD", "CHALLENGE"].includes(difficulty)) {
      return NextResponse.json({ error: "Invalid difficulty." }, { status: 400 })
    }

    // Validate status transitions if a status change is requested.
    if (newStatus !== undefined && newStatus !== bounty.status) {
      const allowed: Record<string, string[]> = {
        OPEN:      ["CLOSED"],
        CLAIMED:   ["CLOSED"], // closing an active claim is a forceful override
        FULFILLED: [],         // terminal
        CLOSED:    ["OPEN"],
      }
      if (!allowed[bounty.status]?.includes(newStatus)) {
        return NextResponse.json({ error: `Cannot transition ${bounty.status} → ${newStatus}.` }, { status: 400 })
      }
    }

    const updated = await prisma.bounty.update({
      where: { id },
      data: {
        ...(count !== undefined && { count: Math.max(bounty.filledCount, Number(count)) }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(difficulty !== undefined && { difficulty: difficulty as QuestionDifficulty | null }),
        ...(year !== undefined && { year: year ? Number(year) : null }),
        ...(chapterId !== undefined && { chapterId: chapterId || null }),
        ...(newStatus !== undefined && newStatus !== bounty.status && {
          status: newStatus,
          // If closing, drop the claim. If reopening, leave claim fields as-is (they'll be null).
          ...(newStatus === "CLOSED" ? { claimedById: null, claimExpiresAt: null } : {}),
        }),
      },
    })

    writeAudit(actor.id, "BOUNTY_UPDATED", "Bounty", id, body)

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof BountyError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}

// DELETE /api/bounties/[id] — admin only, hard delete.
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const session = await auth()
  if (!isPlatformAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }
  const { id } = await params
  await prisma.bounty.delete({ where: { id } })
  writeAudit(session!.user!.id, "BOUNTY_DELETED", "Bounty", id, {})
  return new NextResponse(null, { status: 204 })
}
