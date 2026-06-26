import "server-only"
import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isEffectivelyOpen } from "@/lib/bounties"
import { BountiesBrowserClient } from "./BountiesBrowserClient"

export const metadata = { title: "Bounty board" }

export default async function ContributorBountiesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id
  const role = session.user.role

  if (role !== "CONTRIBUTOR" && role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "CO_FOUNDER") {
    redirect("/contributors/apply")
  }

  const bounties = await prisma.bounty.findMany({
    where: { status: { in: ["OPEN", "CLAIMED"] } },
    include: {
      curriculum: { select: { code: true, displayName: true } },
      subject:    { select: { code: true, name: true } },
      chapter:    { select: { name: true } },
      claimedBy:  { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  })

  // Bucket: active claims by me, open (or expired-claim) for the taking, claimed by others.
  const myClaims = bounties.filter((b) =>
    b.status === "CLAIMED" && b.claimedById === userId && !isEffectivelyOpen(b),
  )
  const openish  = bounties.filter((b) => isEffectivelyOpen(b))
  const others   = bounties.filter((b) =>
    b.status === "CLAIMED" && b.claimedById !== userId && !isEffectivelyOpen(b),
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Bounty board</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Claim a bounty (7-day soft lock), submit matching questions, earn share when they publish.
          </p>
        </div>
        <Link href="/contributors/dashboard" className="text-sm font-semibold text-lime-700 hover:underline dark:text-lime-400">
          ← Dashboard
        </Link>
      </div>

      <BountiesBrowserClient
        currentUserId={userId}
        myClaims={myClaims}
        openBounties={openish}
        othersClaims={others}
      />
    </div>
  )
}

