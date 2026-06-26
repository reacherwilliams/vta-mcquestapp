import "server-only"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createHmac } from "crypto"

// RevenueCat sends an Authorization header with the webhook secret.
function verifySecret(req: Request): boolean {
  const header = req.headers.get("authorization")
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET
  if (!secret) return true // dev: skip verification
  return header === secret
}

type RCEvent = {
  event: {
    type: string
    app_user_id: string
    aliases?: string[]
    product_id?: string
    period_type?: string
    expiration_at_ms?: number
  }
}

function planFromProductId(productId: string | undefined): "PRO" | "PRO_FAMILY" | null {
  if (!productId) return null
  if (productId.includes("family")) return "PRO_FAMILY"
  if (productId.includes("pro")) return "PRO"
  return null
}

export async function POST(req: Request) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  let body: RCEvent
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Bad JSON." }, { status: 400 })
  }

  const { type, app_user_id, product_id, expiration_at_ms } = body.event
  const userId = app_user_id
  const periodEnd = expiration_at_ms ? new Date(expiration_at_ms) : null
  const plan = planFromProductId(product_id)

  switch (type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "PRODUCT_CHANGE": {
      if (!plan) break
      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan,
          status: "ACTIVE",
          source: "APP_STORE",
          currentPeriodEnd: periodEnd,
        },
        update: {
          plan,
          status: "ACTIVE",
          source: "APP_STORE",
          currentPeriodEnd: periodEnd,
        },
      })
      break
    }
    case "CANCELLATION":
    case "EXPIRATION": {
      await prisma.subscription.updateMany({
        where: { userId },
        data: { status: "CANCELED", currentPeriodEnd: periodEnd },
      })
      break
    }
    case "BILLING_ISSUE": {
      await prisma.subscription.updateMany({
        where: { userId },
        data: { status: "PAST_DUE" },
      })
      break
    }
    default:
      break
  }

  return NextResponse.json({ ok: true })
}
