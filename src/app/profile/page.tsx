import Link from "next/link"
import { auth } from "@/lib/auth"
import { isAdminTier } from "@/lib/permissions"
import { BottomNav } from "@/app/practice/BottomNav"
import { SignOutButton } from "@/components/ui/SignOutButton"

export const metadata = { title: "Profile" }

const MOCK_USER = {
  firstName: "Alex",
  lastName: "Kim",
  email: "alex@example.com",
  level: 4,
  totalXp: 1240,
  streak: 7,
  longestStreak: 14,
}

const MOCK_BADGES = [
  { key: "first_correct", name: "First blood", icon: "⚡", earned: true },
  { key: "streak_7", name: "On a roll", icon: "🔥", earned: true },
  { key: "first_retry", name: "Face your fears", icon: "👻", earned: true },
  { key: "streak_30", name: "Unstoppable", icon: "🚀", earned: false },
  { key: "perfect_session", name: "Flawless", icon: "✨", earned: false },
  { key: "subject_mastered", name: "Physics Master", icon: "🎓", earned: false },
]

export default async function ProfilePage() {
  const session = await auth()
  const isAdmin = isAdminTier(session?.user?.role)

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <div className="h-1 bg-linear-to-r from-orange-500 via-amber-500 to-lime-500" />

      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur dark:border-slate-900 dark:bg-slate-950/95">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-3 sm:px-10">
          <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Profile</h1>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <Link href="/admin" className="flex items-center gap-1 text-xs font-semibold text-lime-700 transition hover:text-lime-900 dark:text-lime-400 dark:hover:text-lime-200">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                </svg>
                Admin
              </Link>
            )}
            <Link href="/settings" className="text-xs font-medium text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300">
              Settings
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-6 py-6 pb-28 sm:px-10">

        {/* Avatar + name */}
        <section className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-orange-400 to-lime-500 text-2xl font-black text-white">
            {MOCK_USER.firstName[0]}
          </div>
          <div>
            <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              {MOCK_USER.firstName} {MOCK_USER.lastName}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{MOCK_USER.email}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="rounded-full bg-lime-100 px-2.5 py-0.5 text-[11px] font-bold text-lime-700 dark:bg-lime-950/40 dark:text-lime-300">
                Level {MOCK_USER.level}
              </span>
              <span className="text-[11px] text-slate-400">{MOCK_USER.totalXp.toLocaleString()} XP total</span>
            </div>
          </div>
        </section>

        {/* Stats row */}
        <section className="grid grid-cols-3 gap-3">
          {[
            { label: "Current streak", value: `${MOCK_USER.streak}🔥`, sub: "days" },
            { label: "Longest streak", value: `${MOCK_USER.longestStreak}`, sub: "days" },
            { label: "Total XP", value: MOCK_USER.totalXp.toLocaleString(), sub: "points" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white py-4 dark:border-slate-800 dark:bg-slate-900">
              <span className="text-xl font-black text-slate-900 dark:text-slate-100">{value}</span>
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">{sub}</span>
            </div>
          ))}
        </section>

        {/* Badges */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Badges
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {MOCK_BADGES.map((b) => (
              <div
                key={b.key}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-4 text-center ${
                  b.earned
                    ? "border-lime-200 bg-lime-50 dark:border-lime-900 dark:bg-lime-950/20"
                    : "border-slate-200 bg-white opacity-40 dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <span className="text-2xl">{b.icon}</span>
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{b.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Settings */}
        <section className="space-y-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {[
            { label: "Edit preferences", href: "#" },
            { label: "Change password", href: "#" },
            { label: "Notifications", href: "#" },
            { label: "Privacy settings", href: "#" },
          ].map(({ label, href }, i, arr) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center justify-between px-5 py-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 ${
                i < arr.length - 1 ? "border-b border-slate-100 dark:border-slate-800" : ""
              }`}
            >
              {label}
              <span className="text-slate-400">›</span>
            </Link>
          ))}
        </section>

      </main>

      <BottomNav />
    </div>
  )
}
