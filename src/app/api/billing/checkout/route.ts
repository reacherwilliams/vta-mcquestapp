import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { stripe, PRICES } from "@/lib/stripe/client"

const PLAN_PRICES: Record<string, Record<string, string>> = {
  PRO:        { monthly: PRICES.PRO_MONTHLY,    yearly: PRICES.PRO_YEARLY },
  PRO_FAMILY: { monthly: PRICES.FAMILY_MONTHLY, yearly: PRICES.FAMILY_YEARLY },
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  }

  const { plan = "PRO", interval = "monthly" } = await req.json()

  const priceId = PLAN_PRICES[plan]?.[interval]
  if (!priceId) {
    return NextResponse.json({ error: "Invalid plan or interval." }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  // Reuse existing Stripe customer if available
  let stripeCustomerId: string | undefined
  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripeCustomerId: true },
  })
  stripeCustomerId = sub?.stripeCustomerId ?? undefined

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: session.user.email!,
      name: `${session.user.firstName} ${session.user.lastName}`.trim(),
      metadata: { userId: session.user.id },
    })
    stripeCustomerId = customer.id
  }

  const checkout = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/practice?upgraded=1`,
    cancel_url: `${appUrl}/pricing`,
    metadata: { userId: session.user.id, plan },
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: checkout.url })
}
