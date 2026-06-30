// Pure per-subject pricing math — no server-only deps, safe to import in client
// components (the subscribe page estimate) and on the server. The authoritative
// charge is still computed by Stripe's volume-tiered Price; this mirrors it for
// the on-site estimate and must be kept in sync with that Price.

export type PriceTier = { minQty: number; perSubjectCents: number }
export type PricingConfig = {
  currency: string
  // Volume tiers, ascending by minQty. The per-subject rate is the highest tier
  // whose minQty <= quantity, applied to ALL subjects (volume, not graduated).
  tiers: PriceTier[]
  // A year is billed as this many months (e.g. 10 = "2 months free").
  yearlyMonths: number
}

export const DEFAULT_PRICING: PricingConfig = {
  currency: "usd",
  tiers: [
    { minQty: 1, perSubjectCents: 500 },
    { minQty: 3, perSubjectCents: 400 },
    { minQty: 5, perSubjectCents: 300 },
  ],
  yearlyMonths: 10,
}

export type PriceQuote = {
  perSubjectCents: number
  totalCents: number
  quantity: number
  interval: "monthly" | "yearly"
  currency: string
}

/** Quote for `quantity` subjects at the given interval (volume-tier pricing). */
export function computeSubjectPrice(config: PricingConfig, quantity: number, interval: "monthly" | "yearly"): PriceQuote {
  const qty = Math.max(0, Math.round(quantity))
  // Highest tier whose minQty <= qty (tiers sorted ascending).
  const tier = [...config.tiers].reverse().find((t) => qty >= t.minQty) ?? config.tiers[0]
  const monthlyPer = tier?.perSubjectCents ?? 0
  const months = interval === "yearly" ? config.yearlyMonths : 1
  const perSubjectCents = monthlyPer * months
  return { perSubjectCents, totalCents: perSubjectCents * qty, quantity: qty, interval, currency: config.currency }
}

/** Format cents in the config currency, e.g. 500 → "$5.00". */
export function formatMoney(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100)
}
