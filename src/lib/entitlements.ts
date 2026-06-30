import "server-only"
import { prisma } from "@/lib/prisma"
import { isAdminTier } from "@/lib/permissions"
import { PRICES } from "@/lib/stripe/client"
import { type PricingConfig, DEFAULT_PRICING } from "@/lib/pricing"

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

/**
 * Whether the entitlement regime grants this user UNCAPPED access — i.e. the
 * legacy FREE daily limit should NOT apply. True only when the gate is on AND
 * the user is an admin or holds an active enrollment (trial or paid). When the
 * gate is off this is always false, so the legacy FREE-tier behaviour is intact.
 * Grandfathered FREE users (no enrollment) stay on the legacy cap.
 */
export async function hasEntitlementFullAccess(userId: string, role?: string | null): Promise<boolean> {
  const gate = await getEntitlementGate()
  if (!gate.enabled) return false
  if (isAdminTier(role)) return true
  const count = await prisma.enrollment.count({
    where: { userId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
  })
  return count > 0
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

// ─── Pricing ──────────────────────────────────────────────────────────────────
// Per-subject volume pricing. The actual charge is governed by the Stripe Price's
// volume tiers; this config drives the on-site estimate and the pricing page, and
// MUST mirror the Stripe Price. Subscriptions are billed with quantity = number
// of subjects.

const PRICING_KEY = "entitlement_pricing"

export async function getPricingConfig(): Promise<PricingConfig> {
  const row = await prisma.platformSetting.findUnique({ where: { key: PRICING_KEY } })
  const v = row?.value as Partial<PricingConfig> | undefined
  if (!v) return DEFAULT_PRICING
  return {
    currency: v.currency ?? DEFAULT_PRICING.currency,
    tiers: Array.isArray(v.tiers) && v.tiers.length ? [...v.tiers].sort((a, b) => a.minQty - b.minQty) : DEFAULT_PRICING.tiers,
    yearlyMonths: typeof v.yearlyMonths === "number" && v.yearlyMonths > 0 ? v.yearlyMonths : DEFAULT_PRICING.yearlyMonths,
  }
}

export async function setPricingConfig(config: PricingConfig, updatedById?: string): Promise<void> {
  const clean: PricingConfig = {
    currency: (config.currency || "usd").toLowerCase(),
    tiers: (config.tiers ?? [])
      .filter((t) => Number.isFinite(t.minQty) && t.minQty >= 1 && Number.isFinite(t.perSubjectCents) && t.perSubjectCents >= 0)
      .map((t) => ({ minQty: Math.round(t.minQty), perSubjectCents: Math.round(t.perSubjectCents) }))
      .sort((a, b) => a.minQty - b.minQty),
    yearlyMonths: Math.max(1, Math.min(12, Math.round(config.yearlyMonths))),
  }
  if (!clean.tiers.length) clean.tiers = DEFAULT_PRICING.tiers
  await prisma.platformSetting.upsert({
    where: { key: PRICING_KEY },
    create: { key: PRICING_KEY, value: clean, updatedById: updatedById ?? null },
    update: { value: clean, updatedById: updatedById ?? null },
  })
}

/**
 * Mark the given subjects as PAID + ACTIVE (no expiry) for a user — called from
 * the Stripe webhook on a successful subject subscription. Upserts so a TRIAL
 * converts to PAID. Does not touch other subjects.
 */
export async function setPaidEnrollments(userId: string, subjectIds: string[]): Promise<void> {
  if (!subjectIds.length) return
  await prisma.$transaction(
    subjectIds.map((subjectId) =>
      prisma.enrollment.upsert({
        where: { userId_subjectId: { userId, subjectId } },
        create: { userId, subjectId, status: "ACTIVE", source: "PAID", expiresAt: null },
        update: { status: "ACTIVE", source: "PAID", expiresAt: null },
      }),
    ),
  )
}

/** subjectId → source for the user's currently-active (unexpired) enrollments. */
export async function getActiveEnrollmentSources(userId: string): Promise<Record<string, string>> {
  const now = new Date()
  const rows = await prisma.enrollment.findMany({
    where: { userId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    select: { subjectId: true, source: true },
  })
  return Object.fromEntries(rows.map((r) => [r.subjectId, r.source]))
}

/** Expire all PAID enrollments for a user — called when their subscription ends. */
export async function expireAllPaidEnrollments(userId: string): Promise<void> {
  await prisma.enrollment.updateMany({
    where: { userId, source: "PAID" },
    data: { status: "EXPIRED" },
  })
}

/**
 * Make the user's PAID enrollments exactly `subjectIds`: expire any PAID subject
 * not in the set, and (re)activate the listed ones as PAID. Used when a student
 * self-serve changes their subject subscription. (Trials in the set convert to
 * PAID.)
 */
export async function reconcilePaidEnrollments(userId: string, subjectIds: string[]): Promise<void> {
  await prisma.enrollment.updateMany({
    where: { userId, source: "PAID", subjectId: { notIn: subjectIds } },
    data: { status: "EXPIRED" },
  })
  if (subjectIds.length) {
    await prisma.$transaction(
      subjectIds.map((subjectId) =>
        prisma.enrollment.upsert({
          where: { userId_subjectId: { userId, subjectId } },
          create: { userId, subjectId, status: "ACTIVE", source: "PAID", expiresAt: null },
          update: { status: "ACTIVE", source: "PAID", expiresAt: null },
        }),
      ),
    )
  }
}

export type SubjectSubscriptionState = {
  active: boolean
  interval: "monthly" | "yearly" | null
  stripeSubscriptionId: string | null
  paidSubjectIds: string[]
}

/**
 * The user's current per-subject subscription, identified by the Subscription
 * row's Stripe price matching a SUBJECT_* price. Powers the "manage vs. new
 * subscribe" branch on the subscribe page.
 */
export async function getSubjectSubscription(userId: string): Promise<SubjectSubscriptionState> {
  const [sub, sources] = await Promise.all([
    prisma.subscription.findUnique({
      where: { userId },
      select: { stripeSubscriptionId: true, stripePriceId: true, status: true },
    }),
    getActiveEnrollmentSources(userId),
  ])
  const price = sub?.stripePriceId
  const interval: "monthly" | "yearly" | null =
    price && price === PRICES.SUBJECT_YEARLY ? "yearly" : price && price === PRICES.SUBJECT_MONTHLY ? "monthly" : null
  const active = !!sub?.stripeSubscriptionId && interval !== null && sub.status !== "CANCELED" && sub.status !== "EXPIRED"
  const paidSubjectIds = Object.entries(sources).filter(([, s]) => s === "PAID").map(([id]) => id)
  return { active, interval, stripeSubscriptionId: sub?.stripeSubscriptionId ?? null, paidSubjectIds }
}

