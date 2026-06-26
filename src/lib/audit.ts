import "server-only"
import { prisma } from "@/lib/prisma"

type AuditAction =
  | "QUESTION_CREATED"
  | "QUESTION_UPDATED"
  | "QUESTION_STATUS_CHANGED"
  | "QUESTION_DELETED"
  | "USER_ROLE_CHANGED"
  | "USER_STATUS_CHANGED"
  | "PASSWORD_CHANGED"
  | "PASSWORD_RESET"
  | "BULK_IMPORT"
  | "BOUNTY_CREATED"
  | "BOUNTY_UPDATED"
  | "BOUNTY_DELETED"
  | "BOUNTY_CLAIMED"
  | "BOUNTY_RELEASED"

export async function writeAudit(
  userId: string,
  action: AuditAction,
  entity: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
) {
  // Fire-and-forget — never block the main request on audit writes
  prisma.auditLog.create({
    data: { userId, action, entity, entityId, metadata: metadata as object },
  }).catch(() => {/* silently swallow — audit must never crash the real operation */})
}
