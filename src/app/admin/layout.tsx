import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isAdminTier } from "@/lib/permissions"
import { AdminNav } from "./AdminNav"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const role = session.user.role as string | undefined
  if (!isAdminTier(role)) redirect("/practice")

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <AdminNav role={role} />
      <div className="flex min-w-0 flex-1 flex-col pt-13.25 md:pt-0">
        <div className="h-1 bg-linear-to-r from-orange-500 via-amber-500 to-lime-500" />
        <main className="flex-1 p-6 sm:p-8">{children}</main>
      </div>
    </div>
  )
}
