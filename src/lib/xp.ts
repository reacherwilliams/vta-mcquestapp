import "server-only"

// ── XP award amounts ──────────────────────────────────────────────────────────

export const XP_CORRECT: Record<string, number> = {
  EASY: 5,
  MEDIUM: 8,
  HARD: 12,
  CHALLENGE: 20,
}
export const XP_WRONG = 1
export const XP_STREAK_BONUS = 3   // added per correct answer when streak ≥ 7

export function calcXp(
  isCorrect: boolean,
  difficulty: string,
  streakCurrent: number,
): { amount: number; reason: string } {
  if (!isCorrect) return { amount: XP_WRONG, reason: "wrong_attempt" }
  const base = XP_CORRECT[difficulty] ?? XP_CORRECT.MEDIUM
  const bonus = streakCurrent >= 7 ? XP_STREAK_BONUS : 0
  const amount = base + bonus
  const reason = bonus > 0
    ? `correct_${difficulty.toLowerCase()}_streak_bonus`
    : `correct_${difficulty.toLowerCase()}`
  return { amount, reason }
}

// ── Level curve ───────────────────────────────────────────────────────────────
// Cumulative XP required to reach each level (index = level - 1).
// L1 starts at 0; each threshold is ~1.5× the gap of the previous one.

const THRESHOLDS = [0, 100, 250, 500, 900, 1_500, 2_400, 3_800, 6_000, 9_500, 15_000, 23_000, 35_000]

export function levelFromXp(totalXp: number): number {
  let level = 1
  for (let i = 1; i < THRESHOLDS.length; i++) {
    if (totalXp >= THRESHOLDS[i]) level = i + 1
    else break
  }
  return level
}

export function levelProgress(totalXp: number): {
  level: number
  xpIntoLevel: number
  xpForLevel: number
  pct: number
} {
  const level = levelFromXp(totalXp)
  const idx = level - 1
  const floorXp = THRESHOLDS[idx] ?? 0
  const ceilXp = THRESHOLDS[idx + 1] ?? THRESHOLDS[THRESHOLDS.length - 1] + 10_000
  const xpIntoLevel = totalXp - floorXp
  const xpForLevel = ceilXp - floorXp
  return { level, xpIntoLevel, xpForLevel, pct: Math.round((xpIntoLevel / xpForLevel) * 100) }
}
