import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { stripe, PRICES } from "@/lib/stripe/client"
import { getSubjectSubscription, reconcilePaidEnrollments, expireAllPaidEnrollments } from "@/lib/entitlements"

// Self-serve add/remove subjects on an EXISTING subject subscription. Adjusts
// the Stripe subscription item quantity (proration applies) and reconciles the
// user's PAID enrollments. Removing all subjects cancels the subscription.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  }
  const userId = session.user.id

  const state = await getSubjectSubscription(userId)
  if (!state.active || !state.stripeSubscriptionId) {
    return NextResponse.json({ error: "No active subject subscription to update." }, { status: 400 })
  }

  let body: { subjectIds?: string[] }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }
  const requested = [...new Set(body.subjectIds ?? [])]
  if (requested.length > 15) {
    return NextResponse.json({ error: "Please keep your subscription to at most 15 subjects." }, { status: 400 })
  }

  // Cancel when emptied out.
  if (requested.length === 0) {
    await stripe.subscriptions.cancel(state.stripeSubscriptionId)
    await expireAllPaidEnrollments(userId)
    return NextResponse.json({ ok: true, canceled: true })
  }

  // Validate the subjects exist + are active.
  const subjects = await prisma.subject.findMany({
    where: { id: { in: requested }, isActive: true },
    select: { id: true },
  })
  const subjectIds = subjects.map((s) => s.id)
  if (subjectIds.length !== requested.length) {
    return NextResponse.json({ error: "One or more subjects are unavailable." }, { status: 400 })
  }

  // Find the subject line item on the Stripe subscription and update its quantity.
  const sub = await stripe.subscriptions.retrieve(state.stripeSubscriptionId)
  const subjectPriceIds = [PRICES.SUBJECT_MONTHLY, PRICES.SUBJECT_YEARLY].filter(Boolean)
  const item = sub.items.data.find((it) => subjectPriceIds.includes(it.price.id))
  if (!item) {
    return NextResponse.json({ error: "Subscription has no subject line item." }, { status: 409 })
  }

  const metadata = { userId, kind: "subjects", interval: state.interval ?? "monthly", subjectIds: subjectIds.join(",") }
  await stripe.subscriptions.update(state.stripeSubscriptionId, {
    items: [{ id: item.id, quantity: subjectIds.length }],
    proration_behavior: "create_prorations",
    metadata,
  })

  await reconcilePaidEnrollments(userId, subjectIds)
  return NextResponse.json({ ok: true, quantity: subjectIds.length })
}
