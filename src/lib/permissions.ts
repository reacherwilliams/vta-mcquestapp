import type { UserRole } from "@prisma/client"

// ─────────────────────────────────────────────────────────────────────────────
// Central authorization matrix. This is the single source of truth for what
// each role can do — prefer these helpers over inline `role === "..."` checks
// so a role's powers live in one place.
//
//                        Question Bank /   Oversee admins    Finance     Finance
//   Role                 admin tooling     (Platform Team)   (view)      (move money)
//   SUPER_ADMIN              ✓                 ✓               ✓            ✓
//   CO_FOUNDER              ✓                 ✓               ✓            ✗
//   ADMIN                   ✓                 ✗               ✗            ✗
//   CONTRIBUTOR / STUDENT   ✗                 ✗               ✗            ✗
// ─────────────────────────────────────────────────────────────────────────────

type Role = UserRole | string | undefined | null

/** Can reach the /admin area and content tooling (questions, imports, etc.). */
export function isAdminTier(role: Role): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

/** Founder tier — full platform authority (super admin or co-founder). */
export function isFounderTier(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

/** Manage the platform team: admins, reviewers, contributors (oversee admins). */
export function canManageTeam(role: Role): boolean {
  return isFounderTier(role)
}

/** View finance dashboards (income, expense, payouts). Read-only. */
export function canViewFinance(role: Role): boolean {
  return isFounderTier(role)
}

/** Move money: run payouts, issue refunds, change subscriptions. SA only. */
export function canManageFinance(role: Role): boolean {
  return role === "SUPER_ADMIN"
}

/**
 * Access the Original Question Bank (copyrighted past-paper originals used for
 * similarity checking). SUPER_ADMIN only, and even then full text is revealed
 * case-by-case via an audited action — never bulk-readable.
 */
export function canViewOriginals(role: Role): boolean {
  return role === "SUPER_ADMIN"
}

/**
 * Whether `actorRole` may grant/assign `targetRole` to someone else.
 *  - SUPER_ADMIN can grant any role.
 *  - CO_FOUNDER can grant ADMIN and below, but not mint SUPER_ADMIN / CO_FOUNDER.
 *  - ADMIN can only grant CONTRIBUTOR / STUDENT (no privilege escalation).
 */
export function canGrantRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === "SUPER_ADMIN") return true
  if (actorRole === "CO_FOUNDER") {
    return targetRole === "ADMIN" || targetRole === "CONTRIBUTOR" || targetRole === "STUDENT"
  }
  if (actorRole === "ADMIN") {
    return targetRole === "CONTRIBUTOR" || targetRole === "STUDENT"
  }
  return false
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  CO_FOUNDER: "Co-Founder",
  ADMIN: "Admin",
  CONTRIBUTOR: "Contributor",
  STUDENT: "Student",
}

/** Human-readable label for a role (e.g. CO_FOUNDER → "Co-Founder"). */
export function roleLabel(role: Role): string {
  return (role && ROLE_LABELS[role as string]) || "User"
}
