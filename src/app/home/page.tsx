import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isAdminTier } from "@/lib/permissions"

// Post-login landing redirector: sends admin-tier users (ADMIN / CO_FOUNDER /
// SUPER_ADMIN) to the admin dashboard, everyone else to the practice app.
export default async function HomeRedirect() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  redirect(isAdminTier(session.user.role) ? "/admin" : "/practice")
}
