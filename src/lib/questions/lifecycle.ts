import "server-only"
import { prisma } from "@/lib/prisma"
import { onQuestionPublished } from "@/lib/bounties"
import type { Prisma, QuestionStatus, UserRole } from "@prisma/client"

// ─── Types ───────────────────────────────────────────────────────────────────

export type Actor = {
  id: string
  role: UserRole
}

export type TransitionAction =
  | "submit"          // DRAFT → IN_SUBJECT_REVIEW or IN_CURRICULUM_REVIEW
  | "approve"         // IN_SUBJECT_REVIEW → IN_CURRICULUM_REVIEW, or IN_CURRICULUM_REVIEW → IN_QA
  | "pass_qa"         // IN_QA → PUBLISHED (admin QA sign-off — makes it student-visible)
  | "fail_qa"         // IN_QA → DRAFT (QA found a problem; returns to author with note)
  | "needs_changes"   // any review stage → DRAFT (returns to author with note)
  | "reject"          // any review stage → DRAFT (returns to author with stronger note)
  | "reassign"        // hand off to another reviewer at the same tier (stays at same status)
  | "archive"         // PUBLISHED → ARCHIVED
  | "restore"         // ARCHIVED → DRAFT (super-admin only)

export type TransitionInput = {
  questionId: string
  action: TransitionAction
  actor: Actor
  // Required for needs_changes / reject (returned to author)
  note?: string
  // Required for reassign
  reassignToUserId?: string
}

export class LifecycleError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPlatformAdmin(role: UserRole) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

/**
 * Check whether the actor has reviewer authority for the given question, at
 * a specific tier. Platform admins always qualify (admin_override).
 */
async function canReviewAt(
  actor: Actor,
  question: { subjectId: string; subject: { curriculumId: string } },
  tier: "SUBJECT" | "CURRICULUM",
): Promise<boolean> {
  if (isPlatformAdmin(actor.role)) return true
  const assignment = await prisma.reviewerAssignment.findFirst({
    where: tier === "SUBJECT"
      ? { userId: actor.id, scope: "SUBJECT", subjectId: question.subjectId }
      : { userId: actor.id, scope: "CURRICULUM", curriculumId: question.subject.curriculumId },
    select: { id: true },
  })
  return !!assignment
}

/**
 * After approving at the subject tier (or when submitting with no subject
 * reviewer wired up), figure out where the question should land next.
 */
async function hasSubjectReviewer(subjectId: string): Promise<boolean> {
  const count = await prisma.reviewerAssignment.count({
    where: { scope: "SUBJECT", subjectId },
  })
  return count > 0
}

function reviewStageFor(status: QuestionStatus): "subject" | "curriculum" | "qa" | "admin" {
  if (status === "IN_SUBJECT_REVIEW") return "subject"
  if (status === "IN_CURRICULUM_REVIEW") return "curriculum"
  if (status === "IN_QA") return "qa"
  return "admin"
}

// ─── The state machine ──────────────────────────────────────────────────────

/**
 * Single chokepoint for every question status mutation. Validates the actor's
 * authority, computes the next status, writes the QuestionReview audit row,
 * and updates the question — all in one transaction.
 *
 * Throws LifecycleError on invalid transitions or insufficient permission.
 * Returns the updated question.
 */
export async function transitionStatus(input: TransitionInput) {
  const { questionId, action, actor, note, reassignToUserId } = input

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { subject: { select: { curriculumId: true } } },
  })
  if (!question) throw new LifecycleError("Question not found.", 404)

  const isOwn = question.authorId === actor.id

  // ── Compute next state + permission rules per action ───────────────────────
  let nextStatus: QuestionStatus = question.status
  let stage = reviewStageFor(question.status)
  let nextReviewerId: string | null = question.lastReviewerId
  let setPublished = false
  let setQaPassed = false

  switch (action) {
    case "submit": {
      if (question.status !== "DRAFT") {
        throw new LifecycleError(`Cannot submit a question in status ${question.status}.`)
      }
      // Author submits their own draft, or admin submits on behalf.
      if (!isOwn && !isPlatformAdmin(actor.role)) {
        throw new LifecycleError("Only the author or an admin can submit a draft.", 403)
      }
      const subjectReviewerExists = await hasSubjectReviewer(question.subjectId)
      nextStatus = subjectReviewerExists ? "IN_SUBJECT_REVIEW" : "IN_CURRICULUM_REVIEW"
      stage = subjectReviewerExists ? "subject" : "curriculum"
      break
    }

    case "approve": {
      if (question.status === "IN_SUBJECT_REVIEW") {
        if (isOwn) throw new LifecycleError("Reviewers cannot approve their own questions.", 403)
        const ok = await canReviewAt(actor, question, "SUBJECT")
        if (!ok) throw new LifecycleError("You are not a reviewer for this subject.", 403)
        nextStatus = "IN_CURRICULUM_REVIEW"
        stage = "subject"
      } else if (question.status === "IN_CURRICULUM_REVIEW") {
        if (isOwn) throw new LifecycleError("Reviewers cannot approve their own questions.", 403)
        const ok = await canReviewAt(actor, question, "CURRICULUM")
        if (!ok) throw new LifecycleError("You are not a reviewer for this curriculum.", 403)
        // Curriculum approval now hands off to QA — NOT straight to students.
        nextStatus = "IN_QA"
        stage = "curriculum"
      } else {
        throw new LifecycleError(`Cannot approve a question in status ${question.status}.`)
      }
      nextReviewerId = actor.id
      break
    }

    case "pass_qa": {
      if (question.status !== "IN_QA") {
        throw new LifecycleError(`Cannot pass QA on a question in status ${question.status}.`)
      }
      if (!isPlatformAdmin(actor.role)) {
        throw new LifecycleError("Only an admin can pass QA.", 403)
      }
      nextStatus = "PUBLISHED"
      stage = "qa"
      nextReviewerId = actor.id
      setPublished = true
      setQaPassed = true
      break
    }

    case "fail_qa": {
      if (question.status !== "IN_QA") {
        throw new LifecycleError(`Cannot fail QA on a question in status ${question.status}.`)
      }
      if (!isPlatformAdmin(actor.role)) {
        throw new LifecycleError("Only an admin can fail QA.", 403)
      }
      if (!note || !note.trim()) {
        throw new LifecycleError("A note is required when sending a question back from QA.")
      }
      nextStatus = "DRAFT"
      stage = "qa"
      nextReviewerId = actor.id
      break
    }

    case "needs_changes":
    case "reject": {
      if (!note || !note.trim()) {
        throw new LifecycleError("A note is required when returning a question to the author.")
      }
      if (question.status === "IN_SUBJECT_REVIEW") {
        const ok = await canReviewAt(actor, question, "SUBJECT")
        if (!ok) throw new LifecycleError("You are not a reviewer for this subject.", 403)
        stage = "subject"
      } else if (question.status === "IN_CURRICULUM_REVIEW") {
        const ok = await canReviewAt(actor, question, "CURRICULUM")
        if (!ok) throw new LifecycleError("You are not a reviewer for this curriculum.", 403)
        stage = "curriculum"
      } else {
        throw new LifecycleError(`Cannot return a question in status ${question.status}.`)
      }
      nextStatus = "DRAFT"
      nextReviewerId = actor.id
      break
    }

    case "reassign": {
      if (!reassignToUserId) throw new LifecycleError("A target reviewer is required to reassign.")
      const tier = question.status === "IN_SUBJECT_REVIEW" ? "SUBJECT"
        : question.status === "IN_CURRICULUM_REVIEW" ? "CURRICULUM"
        : null
      if (!tier) throw new LifecycleError(`Cannot reassign a question in status ${question.status}.`)
      const ok = await canReviewAt(actor, question, tier)
      if (!ok) throw new LifecycleError("Only an assigned reviewer (or admin) can reassign.", 403)
      // Verify the target has the right scope.
      const targetAssignment = await prisma.reviewerAssignment.findFirst({
        where: tier === "SUBJECT"
          ? { userId: reassignToUserId, scope: "SUBJECT", subjectId: question.subjectId }
          : { userId: reassignToUserId, scope: "CURRICULUM", curriculumId: question.subject.curriculumId },
        select: { id: true },
      })
      if (!targetAssignment) throw new LifecycleError("Target user is not a reviewer at this tier.")
      stage = tier === "SUBJECT" ? "subject" : "curriculum"
      nextReviewerId = reassignToUserId
      // Status stays the same — only the lastReviewerId hint moves.
      break
    }

    case "archive": {
      if (question.status !== "PUBLISHED") {
        throw new LifecycleError(`Cannot archive a question in status ${question.status}.`)
      }
      if (!isPlatformAdmin(actor.role)) {
        // Curriculum reviewers can also archive within their curriculum.
        const ok = await canReviewAt(actor, question, "CURRICULUM")
        if (!ok) throw new LifecycleError("Only an admin or curriculum reviewer can archive.", 403)
      }
      nextStatus = "ARCHIVED"
      stage = "admin"
      break
    }

    case "restore": {
      if (question.status !== "ARCHIVED") {
        throw new LifecycleError(`Cannot restore a question in status ${question.status}.`)
      }
      if (actor.role !== "SUPER_ADMIN") {
        throw new LifecycleError("Only a super-admin can restore archived questions.", 403)
      }
      nextStatus = "DRAFT"
      stage = "admin"
      break
    }
  }

  // ── Write audit row + update question in one transaction ───────────────────
  const decisionLabel =
    action === "needs_changes" ? "needs_changes"
      : action === "reject" ? "reject"
      : action === "approve" ? "approve"
      : action === "pass_qa" ? "qa_pass"
      : action === "fail_qa" ? "qa_fail"
      : action === "reassign" ? "reassign"
      : action === "archive" ? "archive"
      : action === "restore" ? "restore"
      : "submit"

  const data: Prisma.QuestionUpdateInput = {
    status: nextStatus,
    lastReviewer: nextReviewerId
      ? { connect: { id: nextReviewerId } }
      : { disconnect: true },
    lastReviewNote:
      action === "needs_changes" || action === "reject" || action === "fail_qa" ? note ?? null : null,
  }
  if (setPublished) {
    data.publishedAt = new Date()
    data.publishedBy = { connect: { id: actor.id } }
  }
  if (setQaPassed) {
    data.qaPassedAt = new Date()
    data.qaPassedById = actor.id
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.question.update({ where: { id: questionId }, data })
    await tx.questionReview.create({
      data: {
        questionId,
        reviewerId: actor.id,
        decision: isPlatformAdmin(actor.role) && !isOwn && action === "approve"
          ? "admin_override"
          : decisionLabel,
        stage,
        notes: note ?? null,
      },
    })
    if (setPublished) {
      await onQuestionPublished(tx, question.bountyId)
    }
    return u
  })

  return updated
}
