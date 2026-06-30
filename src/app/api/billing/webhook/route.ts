import "server-only"
import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { stripe } from "@/lib/stripe/client"
import { prisma } from "@/lib/prisma"
import { setPaidEnrollments, expireAllPaidEnrollments } from "@/lib/entitlements"
import type Stripe from "stripe"

export async function POST(req: Request) {
  const body = await req.text()
  const sig = (await headers()).get("stripe-signature")!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 })
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const cs = event.data.object as Stripe.Checkout.Session
      if (cs.mode !== "subscription") break

      const meta = (cs.metadata as Record<string, string>) ?? {}
      const userId = meta.userId
      if (!userId) break

      const subId = typeof cs.subscription === "string" ? cs.subscription : cs.subscription?.id
      if (!subId) break

      const stripeSub = await stripe.subscriptions.retrieve(subId)

      // Per-subject subscription: turn the chosen subjects into PAID enrollments.
      if (meta.kind === "subjects") {
        const subjectIds = (meta.subjectIds ?? "").split(",").filter(Boolean)
        if (subjectIds.length) await setPaidEnrollments(userId, subjectIds)
        await prisma.subscription.upsert({
          where: { userId },
          update: buildSubData("PRO", cs.customer as string, stripeSub),
          create: { userId, ...buildSubData("PRO", cs.customer as string, stripeSub) },
        })
        break
      }

      // Legacy plan subscription (PRO / PRO_FAMILY).
      const plan = meta.plan ?? "PRO"
      await prisma.subscription.upsert({
        where: { userId },
        update: buildSubData(plan, cs.customer as string, stripeSub),
        create: {
          userId,
          ...buildSubData(plan, cs.customer as string, stripeSub),
        },
      })
      break
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subId = (invoice as any).subscription as string | null
      if (!subId) break

      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subId },
        data: { status: "ACTIVE" },
      })
      break
    }

    case "customer.subscription.updated": {
      const stripeSub = event.data.object as Stripe.Subscription
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: stripeSub.id },
        data: {
          status: mapStripeStatus(stripeSub.status),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
          stripePriceId: stripeSub.items.data[0]?.price.id ?? null,
        },
      })
      break
    }

    case "customer.subscription.deleted": {
      const stripeSub = event.data.object as Stripe.Subscription
      // Find the owner so we can revoke their paid subject access.
      const sub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: stripeSub.id },
        select: { userId: true },
      })
      if (sub?.userId) await expireAllPaidEnrollments(sub.userId)

      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: stripeSub.id },
        data: {
          plan: "FREE",
          status: "CANCELED",
          stripeSubscriptionId: null,
          stripePriceId: null,
        },
      })
      break
    }
  }

  return NextResponse.json({ received: true })
}

function buildSubData(plan: string, customerId: string, stripeSub: Stripe.Subscription) {
  return {
    plan: plan as "PRO" | "PRO_FAMILY",
    status: mapStripeStatus(stripeSub.status),
    source: "STRIPE" as const,
    stripeCustomerId: customerId,
    stripeSubscriptionId: stripeSub.id,
    stripePriceId: stripeSub.items.data[0]?.price.id ?? null,
    cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
  }
}

function mapStripeStatus(s: Stripe.Subscription.Status): "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "EXPIRED" {
  switch (s) {
    case "active":   return "ACTIVE"
    case "trialing": return "TRIALING"
    case "past_due": return "PAST_DUE"
    case "canceled": return "CANCELED"
    default:         return "EXPIRED"
  }
}
