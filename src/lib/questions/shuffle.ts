// Deterministic option shuffler for wrong-retry sessions.
//
// Why deterministic? If a student refreshes mid-question, the order must stay
// the same. If they attempt the question again later, the order must change.
// A seeded PRNG gives both guarantees — same seed → same order, different
// seed → different order — without storing the shuffled array client-side.
//
// Seed convention:  `${userId}:${questionId}:${retryCount}`
// Demo convention:  `demo:${questionId}`  (stable, no user needed)

// ── Seeded PRNG (Mulberry32) ───────────────────────────────────────────────
// Maps a 32-bit seed to a sequence of floats in [0, 1).
function mulberry32(seed: number): () => number {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

// FNV-1a hash — turns an arbitrary string into a stable 32-bit integer.
function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// ── Fisher-Yates shuffle ───────────────────────────────────────────────────
// Returns a new array; does not mutate the input.
function fisherYates<T>(items: T[], rng: () => number): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns the option IDs in shuffled order for a given seed.
 * Image/graph-only option sets are never shuffled (visual layout is part of
 * the question context — e.g. "which graph shows…").
 */
export function shuffledOptionIds(
  optionIds: string[],
  seed: string,
  isImageOptions: boolean,
): string[] {
  if (isImageOptions || optionIds.length <= 1) return optionIds
  return fisherYates(optionIds, mulberry32(fnv1a(seed)))
}

/**
 * Re-orders an options array to match a stored id ordering.
 * Used when retrieving options that were shuffled at session-creation time.
 */
export function applyOptionOrder<T extends { id: string }>(
  options: T[],
  orderedIds: string[],
): T[] {
  const map = new Map(options.map((o) => [o.id, o]))
  return orderedIds.map((id) => map.get(id)).filter((o): o is T => o !== undefined)
}

/**
 * Convenience: shuffle an options array directly using a seed string.
 * Use this at render time (demo page) where you have the full objects.
 */
export function shuffleOptions<T extends { id: string }>(
  options: T[],
  seed: string,
  isImageOptions: boolean,
): T[] {
  if (isImageOptions || options.length <= 1) return options
  const orderedIds = shuffledOptionIds(options.map((o) => o.id), seed, false)
  return applyOptionOrder(options, orderedIds)
}
