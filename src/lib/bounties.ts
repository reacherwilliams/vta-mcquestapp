import "server-only"
import { prisma } from "@/lib/prisma"
import type { Prisma, QuestionDifficulty, UserRole } from "@prisma/client"

export const CLAIM_HOLD_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export class BountyError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

function isPlatformAdmin(role: UserRole) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

/**
 * A bounty is "effectively open" if it has no active claim OR its claim has
 * expired. We don't bulk-reset expired claims on a cron — we resolve laziness
 * when someone tries to claim.
 */
export function isEffectivelyOpen(b: { status: string; claimExpiresAt: Date | null }): boolean {
  if (b.status === "OPEN") return true
  if (b.status !== "CLAIMED") return false
  return !b.claimExpiresAt || b.claimExpiresAt.getTime() < Date.now()
}

/**
 * Authority check — who can create / edit / close a bounty for this curriculum?
 *   - SUPER_ADMIN, ADMIN: any curriculum
 *   - CurriculumReviewer assigned to the curriculum: that curriculum only
 */
export async function canManageBounty(
  actor: { id: string; role: UserRole },
  curriculumId: string,
): Promise<boolean> {
  if (isPlatformAdmin(actor.role)) return true
  const assignment = await prisma.reviewerAssignment.findFirst({
    where: { userId: actor.id, scope: "CURRICULUM", curriculumId },
    select: { id: true },
  })
  return !!assignment
}

/**
 * Find an active claim a contributor has that *matches* a question's
 * (subject, chapter, year, difficulty). Used to auto-link bounties to
 * submitted questions when the contributor doesn't explicitly pick one.
 */
export async function findMatchingActiveClaim(
  userId: string,
  question: {
    subjectId: string
    chapterId: string
    year: number | null
    difficulty: QuestionDifficulty
  },
): Promise<string | null> {
  const claims = await prisma.bounty.findMany({
    where: {
      claimedById: userId,
      status: "CLAIMED",
      subjectId: question.subjectId,
    },
    select: {
      id: true, claimExpiresAt: true, chapterId: true, year: true, difficulty: true,
    },
  })
  for (const c of claims) {
    if (c.claimExpiresAt && c.claimExpiresAt.getTime() < Date.now()) continue
    if (c.chapterId && c.chapterId !== question.chapterId) continue
    if (c.year !== null && c.year !== question.year) continue
    if (c.difficulty && c.difficulty !== question.difficulty) continue
    return c.id
  }
  return null
}

/**
 * Called from the lifecycle helper when a question reaches PUBLISHED. If it's
 * tagged with a bountyId, decrement filledCount; if that hits count, mark
 * FULFILLED. Idempotent — safe to call even if the question isn't tagged.
 *
 * Runs in the caller's transaction context: pass the transaction client so
 * the bounty update commits atomically with the question publish.
 */
export async function onQuestionPublished(
  tx: Prisma.TransactionClient,
  bountyId: string | null,
): Promise<void> {
  if (!bountyId) return
  const bounty = await tx.bounty.findUnique({
    where: { id: bountyId },
    select: { count: true, filledCount: true, status: true },
  })
  if (!bounty) return
  if (bounty.status === "FULFILLED" || bounty.status === "CLOSED") return
  const nextFilled = bounty.filledCount + 1
  await tx.bounty.update({
    where: { id: bountyId },
    data: {
      filledCount: nextFilled,
      ...(nextFilled >= bounty.count
        ? { status: "FULFILLED", claimedById: null, claimExpiresAt: null }
        : {}),
    },
  })
}
