import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { stripe, PRICES } from "@/lib/stripe/client"

// Subscribe to a set of subjects. Billed as ONE subscription with quantity =
// number of subjects on a volume-tiered Stripe Price, so the per-subject rate
// drops as more are added. The chosen subjects ride along in metadata; the
// webhook turns them into PAID enrollments on success.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  }
  const userId = session.user.id

  let body: { subjectIds?: string[]; interval?: "monthly" | "yearly" }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  const interval = body.interval === "yearly" ? "yearly" : "monthly"
  const requested = [...new Set(body.subjectIds ?? [])]
  if (!requested.length) {
    return NextResponse.json({ error: "Pick at least one subject." }, { status: 400 })
  }
  // Metadata values cap at 500 chars; keep the basket sane.
  if (requested.length > 15) {
    return NextResponse.json({ error: "Please subscribe to at most 15 subjects at a time." }, { status: 400 })
  }

  // Validate they're real, active subjects.
  const subjects = await prisma.subject.findMany({
    where: { id: { in: requested }, isActive: true },
    select: { id: true },
  })
  const subjectIds = subjects.map((s) => s.id)
  if (subjectIds.length !== requested.length) {
    return NextResponse.json({ error: "One or more subjects are unavailable." }, { status: 400 })
  }

  const priceId = interval === "yearly" ? PRICES.SUBJECT_YEARLY : PRICES.SUBJECT_MONTHLY
  if (!priceId) {
    return NextResponse.json({ error: "Subject pricing isn't configured." }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  // Reuse the existing Stripe customer if we have one.
  const existing = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  })
  let stripeCustomerId = existing?.stripeCustomerId ?? undefined
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: session.user.email!,
      name: `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim(),
      metadata: { userId },
    })
    stripeCustomerId = customer.id
  }

  const metadata = { userId, kind: "subjects", interval, subjectIds: subjectIds.join(",") }

  const checkout = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: subjectIds.length }],
    // Carry the subjects on both the session and the subscription so either
    // webhook event can resolve them.
    subscription_data: { metadata },
    metadata,
    success_url: `${appUrl}/practice?subscribed=1`,
    cancel_url: `${appUrl}/practice/subscribe`,
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: checkout.url })
}
