import "server-only"
import Stripe from "stripe"

// Lazily construct the Stripe client on first use. Constructing it at module
// load breaks `next build` (the "collect page data" pass evaluates the module
// without the secret key in scope). The Proxy keeps the existing
// `stripe.checkout.sessions.create(...)` call sites working unchanged.
let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-04-22.dahlia",
    })
  }
  return _stripe
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripe()
    const value = client[prop as keyof Stripe]
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value
  },
})

// Price IDs — set these in env for each environment
export const PRICES = {
  PRO_MONTHLY:    process.env.STRIPE_PRICE_PRO_MONTHLY!,
  PRO_YEARLY:     process.env.STRIPE_PRICE_PRO_YEARLY!,
  FAMILY_MONTHLY: process.env.STRIPE_PRICE_FAMILY_MONTHLY!,
  FAMILY_YEARLY:  process.env.STRIPE_PRICE_FAMILY_YEARLY!,
  // Per-subject access. These MUST be recurring Stripe Prices with VOLUME tiered
  // pricing (billing_scheme=tiered, tiers_mode=volume) — the subscription is
  // created with quantity = number of subjects and Stripe applies the volume
  // discount. The tier table in the app's pricing config is for display/estimate
  // only and must mirror these Stripe Prices.
  SUBJECT_MONTHLY: process.env.STRIPE_PRICE_SUBJECT_MONTHLY!,
  SUBJECT_YEARLY:  process.env.STRIPE_PRICE_SUBJECT_YEARLY!,
}
