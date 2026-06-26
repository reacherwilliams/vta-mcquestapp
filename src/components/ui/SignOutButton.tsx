"use client"

import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"

// Real sign-out — clears the Auth.js session and returns to /login.
// (Replaces the old placeholder <Link href="/login"> that never logged out.)
export function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={cn(
        "text-xs font-medium text-slate-400 transition hover:text-rose-600 dark:hover:text-rose-400",
        className,
      )}
    >
      Sign out
    </button>
  )
}
