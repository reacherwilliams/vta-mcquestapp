import "server-only"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { isAdminTier } from "@/lib/permissions"
import Link from "next/link"
import { MarathonAdminClient } from "./MarathonAdminClient"

export const metadata = { title: "Marathon Events — Admin" }

export default async function MarathonAdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!user || !isAdminTier(user.role)) redirect("/")

  const events = await prisma.marathonEvent.findMany({
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      title: true,
      questionIds: true,
      startsAt: true,
      endsAt: true,
      _count: { select: { entries: true } },
    },
  })

  const now = new Date()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Marathon Events</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Create and manage Past Paper Marathon events</p>
        </div>
        <Link href="/admin" className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">← Admin</Link>
      </div>

      <MarathonAdminClient
        events={events.map((e) => ({
          ...e,
          startsAt: e.startsAt.toISOString(),
          endsAt: e.endsAt.toISOString(),
          entryCount: e._count.entries,
          active: e.startsAt <= now && e.endsAt > now,
        }))}
      />
    </div>
  )
}
