import "server-only"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { isAdminTier } from "@/lib/permissions"
import Link from "next/link"
import { ContributorAdminClient } from "./ContributorAdminClient"

export const metadata = { title: "Contributors — Admin" }

export default async function ContributorsAdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!me || !isAdminTier(me.role)) redirect("/")

  const [applications, activeContributors] = await Promise.all([
    prisma.contributorApplication.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        statement: true,
        sampleUrl: true,
        notes: true,
        createdAt: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "CONTRIBUTOR" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        stripeConnectId: true,
        _count: { select: { questionsAuthored: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Contributors</h1>
        <Link href="/admin" className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">← Admin</Link>
      </div>

      <ContributorAdminClient
        applications={applications.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        }))}
        contributors={activeContributors.map((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          stripeConnectId: c.stripeConnectId ?? null,
          questionCount: c._count.questionsAuthored,
        }))}
      />
    </div>
  )
}
