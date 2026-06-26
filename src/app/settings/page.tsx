import "server-only"
import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { isAdminTier } from "@/lib/permissions"
import { ChangePasswordForm } from "./ChangePasswordForm"

export const metadata = { title: "Settings" }

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { email, firstName, lastName, role } = session.user
  const backHref = isAdminTier(role) ? "/admin" : "/practice"

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <div className="h-1 bg-linear-to-r from-orange-500 via-amber-500 to-lime-500" />

      <main className="mx-auto w-full max-w-xl flex-1 space-y-6 px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Settings</h1>
          <Link href={backHref} className="text-xs font-medium text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300">
            ← Back
          </Link>
        </div>

        {/* Account */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Account</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400 dark:text-slate-500">Name</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-300">{firstName} {lastName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400 dark:text-slate-500">Email (sign-in)</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-300">{email}</dd>
            </div>
          </dl>
        </section>

        {/* Change password */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Change password</h2>
          <p className="mt-1 mb-4 text-xs text-slate-500 dark:text-slate-400">
            Choose a strong password you don&apos;t use elsewhere. You&apos;ll use it next time you sign in.
          </p>
          <ChangePasswordForm />
        </section>
      </main>
    </div>
  )
}
