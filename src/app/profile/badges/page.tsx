import "server-only"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

const RARITY_STYLES: Record<string, { ring: string; label: string; labelColor: string }> = {
  common:    { ring: "ring-slate-200 dark:ring-slate-700",    label: "Common",    labelColor: "text-slate-500 dark:text-slate-400" },
  rare:      { ring: "ring-sky-300 dark:ring-sky-600",        label: "Rare",      labelColor: "text-sky-600 dark:text-sky-400" },
  epic:      { ring: "ring-lime-400 dark:ring-lime-600",      label: "Epic",      labelColor: "text-lime-600 dark:text-lime-400" },
  legendary: { ring: "ring-amber-400 dark:ring-amber-500",   label: "Legendary", labelColor: "text-amber-500 dark:text-amber-400" },
}

const ICON_MAP: Record<string, React.ReactNode> = {
  "check-circle": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  "flame": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  ),
  "zap": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  "refresh-cw": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  "star": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  "timer": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  "check-square": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
      <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  "award": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
      <circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  ),
}

function BadgeIcon({ iconKey }: { iconKey: string }) {
  return ICON_MAP[iconKey] ?? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
      <circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  )
}

export default async function BadgesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const [awards, allBadges] = await Promise.all([
    prisma.badgeAward.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { awardedAt: "desc" },
    }),
    prisma.badge.findMany({ orderBy: { rarity: "asc" } }),
  ])

  const awardedKeys = new Set(awards.map((a) => a.badge.key))
  const earned = awards.map((a) => ({ ...a.badge, awardedAt: a.awardedAt, earned: true }))
  const locked = allBadges
    .filter((b) => !awardedKeys.has(b.key))
    .map((b) => ({ ...b, awardedAt: null, earned: false }))

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <Link href="/profile" className="text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
          ← Profile
        </Link>
        <span className="text-slate-200 dark:text-slate-700">/</span>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Badges</span>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Your Badges</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {earned.length} earned · {locked.length} remaining
        </p>
      </div>

      {earned.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Earned</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {earned.map((b) => {
              const r = RARITY_STYLES[b.rarity] ?? RARITY_STYLES.common
              return (
                <div
                  key={b.key}
                  className={`flex flex-col items-center rounded-2xl border bg-white p-5 text-center ring-2 ${r.ring} dark:bg-slate-900`}
                >
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-lime-50 text-lime-600 dark:bg-lime-950/40 dark:text-lime-400">
                    <BadgeIcon iconKey={b.iconKey} />
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{b.name}</p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{b.description}</p>
                  <span className={`mt-2 text-[10px] font-bold uppercase tracking-widest ${r.labelColor}`}>
                    {r.label}
                  </span>
                  {b.awardedAt && (
                    <span className="mt-1 text-[10px] text-slate-400 dark:text-slate-600">
                      {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(b.awardedAt)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {locked.length > 0 && (
        <section>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Locked</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {locked.map((b) => (
              <div
                key={b.key}
                className="flex flex-col items-center rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center dark:border-slate-800 dark:bg-slate-900/50"
              >
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600">
                  <BadgeIcon iconKey={b.iconKey} />
                </div>
                <p className="text-sm font-bold text-slate-400 dark:text-slate-600">{b.name}</p>
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-600 leading-snug">{b.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {earned.length === 0 && locked.length === 0 && (
        <p className="text-center text-slate-400 dark:text-slate-500">No badges yet — start practising!</p>
      )}
    </div>
  )
}
