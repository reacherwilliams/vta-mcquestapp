import "server-only"
import { prisma } from "@/lib/prisma"
import { isAdminTier } from "@/lib/permissions"

// ─── Student access entitlements ──────────────────────────────────────────────
// Access is gated per-subject via Enrollment rows. This module is the single
// source of truth for "what may this student practice" — used by the practice
// filter UI and enforced server-side in the session builders. The gate is
// off by default and flag-controlled by Super Admin, so nothing changes for
// existing students until it's switched on.

const GATE_KEY = "entitlement_gate"

export type EntitlementGate = {
  // Master switch. When false, every signed-in user has full access (today's
  // behaviour) and the rest of this module is a no-op.
  enabled: boolean
  // Accounts created before this instant keep full access ("grandfathered"),
  // so flipping the gate on never locks out existing students. Null = no
  // grandfathering (everyone is gated).
  enforceFrom: string | null
}

const DEFAULT_GATE: EntitlementGate = { enabled: false, enforceFrom: null }

export async function getEntitlementGate(): Promise<EntitlementGate> {
  const row = await prisma.platformSetting.findUnique({ where: { key: GATE_KEY } })
  return { ...DEFAULT_GATE, ...((row?.value as Partial<EntitlementGate> | undefined) ?? {}) }
}

export async function setEntitlementGate(gate: EntitlementGate, updatedById?: string): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key: GATE_KEY },
    create: { key: GATE_KEY, value: gate, updatedById: updatedById ?? null },
    update: { value: gate, updatedById: updatedById ?? null },
  })
}

/**
 * The set of subject ids a user may practice.
 *
 * Returns `null` for UNRESTRICTED access — meaning "all subjects" — which is the
 * case when the gate is off, the user is an admin (always exempt), or the
 * account predates the gate's enforceFrom date (grandfathered).
 *
 * Otherwise returns the concrete list of subject ids the user holds an ACTIVE,
 * unexpired Enrollment for (possibly empty → no access).
 *
 * Pass `role` from the session when available to skip a lookup.
 */
export async function getEntitledSubjectScope(userId: string, role?: string | null): Promise<string[] | null> {
  const gate = await getEntitlementGate()
  if (!gate.enabled) return null

  let resolvedRole = role
  if (resolvedRole === undefined) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    resolvedRole = u?.role ?? null
  }
  if (isAdminTier(resolvedRole)) return null // admins/founders always exempt

  if (gate.enforceFrom) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } })
    if (u && u.createdAt < new Date(gate.enforceFrom)) return null // grandfathered
  }

  const now = new Date()
  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { subjectId: true },
  })
  return enrollments.map((e) => e.subjectId)
}

/** True if `scope` (from getEntitledSubjectScope) permits the given subject. */
export function scopeAllows(scope: string[] | null, subjectId: string): boolean {
  return scope === null || scope.includes(subjectId)
}
