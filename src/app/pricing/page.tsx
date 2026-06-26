import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PricingClient } from "./PricingClient"

export const metadata = { title: "Pricing — MCQ MasterLoop" }

export default async function PricingPage() {
  const session = await auth()

  let currentPlan: string = "FREE"
  if (session?.user?.id) {
    const sub = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
      select: { plan: true },
    })
    currentPlan = sub?.plan ?? "FREE"
  }

  return <PricingClient currentPlan={currentPlan} isSignedIn={!!session?.user?.id} />
}
