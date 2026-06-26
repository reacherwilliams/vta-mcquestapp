import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UsersTable } from "./UsersTable"

export const metadata = { title: "Admin — Users" }

type Props = { searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string; action?: string }> }

export default async function UsersPage({ searchParams }: Props) {
  const session = await auth()
  const actorRole = session?.user?.role as string | undefined
  const isSuperAdmin = actorRole === "SUPER_ADMIN"

  const { q = "", role = "", status = "", page: pageStr = "1" } = await searchParams
  const page = Math.max(1, Number(pageStr))
  const limit = 30

  const where = {
    ...(q ? {
      OR: [
        { email: { contains: q, mode: "insensitive" as const } },
        { firstName: { contains: q, mode: "insensitive" as const } },
        { lastName: { contains: q, mode: "insensitive" as const } },
      ],
    } : {}),
    ...(role ? { role: role as "SUPER_ADMIN" | "CO_FOUNDER" | "ADMIN" | "CONTRIBUTOR" | "STUDENT" } : {}),
    ...(status ? { status: status as "ACTIVE" | "PENDING" | "SUSPENDED" | "DELETED" } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, emailVerified: true,
        createdAt: true, lastLoginAt: true,
        _count: { select: { attempts: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ])

  const pages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Users</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{total.toLocaleString()} total</p>
        </div>
        <Link
          href="/admin/users?action=invite"
          className="rounded-xl border-b-4 border-lime-700 bg-lime-500 px-4 py-2 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2"
        >
          + Invite User
        </Link>
      </div>
      <UsersTable
        items={items as Parameters<typeof UsersTable>[0]["items"]}
        page={page}
        pages={pages}
        q={q}
        role={role}
        status={status}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  )
}
