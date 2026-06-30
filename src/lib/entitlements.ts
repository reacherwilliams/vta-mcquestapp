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

// ─── Trials ───────────────────────────────────────────────────────────────────
// New students get a time-limited TRIAL enrollment for the subjects they pick
// at signup. The trial length is SA-configurable.

const TRIAL_KEY = "entitlement_trial"
const DEFAULT_TRIAL_DAYS = 7

export async function getTrialDays(): Promise<number> {
  const row = await prisma.platformSetting.findUnique({ where: { key: TRIAL_KEY } })
  const days = (row?.value as { days?: number } | undefined)?.days
  return typeof days === "number" && days > 0 ? days : DEFAULT_TRIAL_DAYS
}

export async function setTrialDays(days: number, updatedById?: string): Promise<void> {
  const clean = Math.max(1, Math.min(365, Math.round(days)))
  await prisma.platformSetting.upsert({
    where: { key: TRIAL_KEY },
    create: { key: TRIAL_KEY, value: { days: clean }, updatedById: updatedById ?? null },
    update: { value: { days: clean }, updatedById: updatedById ?? null },
  })
}

/**
 * Grant a TRIAL enrollment for each subject the student doesn't already hold one
 * for. Idempotent: existing enrollments (trial/paid/comp) are left untouched, so
 * re-running onboarding never resets or extends a trial. Returns the count newly
 * granted.
 */
export async function grantTrialEnrollments(userId: string, subjectIds: string[]): Promise<number> {
  if (!subjectIds.length) return 0
  const existing = await prisma.enrollment.findMany({
    where: { userId, subjectId: { in: subjectIds } },
    select: { subjectId: true },
  })
  const have = new Set(existing.map((e) => e.subjectId))
  const fresh = subjectIds.filter((id) => !have.has(id))
  if (!fresh.length) return 0

  const days = await getTrialDays()
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  await prisma.enrollment.createMany({
    data: fresh.map((subjectId) => ({ userId, subjectId, status: "ACTIVE" as const, source: "TRIAL" as const, expiresAt })),
    skipDuplicates: true,
  })
  return fresh.length
}

export type TrialStatus = { onTrial: boolean; daysLeft: number; expiresAt: Date | null }

/**
 * Trial summary for banners. `onTrial` is true while the student holds an
 * active, unexpired TRIAL enrollment; daysLeft counts down to the SOONEST trial
 * expiry so we can warn before access lapses.
 */
export async function getTrialStatus(userId: string): Promise<TrialStatus> {
  const now = new Date()
  const trial = await prisma.enrollment.findFirst({
    where: { userId, status: "ACTIVE", source: "TRIAL", expiresAt: { gt: now } },
    orderBy: { expiresAt: "asc" },
    select: { expiresAt: true },
  })
  if (!trial?.expiresAt) return { onTrial: false, daysLeft: 0, expiresAt: null }
  const daysLeft = Math.max(0, Math.ceil((trial.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
  return { onTrial: true, daysLeft, expiresAt: trial.expiresAt }
}
