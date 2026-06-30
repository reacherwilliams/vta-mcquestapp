"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import { isFounderTier, roleLabel } from "@/lib/permissions"
import { useEffect, useState } from "react"

const NAV = [
  {
    href: "/admin",
    exact: true,
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: "/admin/questions",
    label: "Question Bank",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    href: "/admin/qa",
    label: "QA Testing",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/admin/import",
    label: "Bulk Import",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
      </svg>
    ),
  },
  {
    href: "/admin/contributors",
    label: "Contributors",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        <line x1="19" y1="8" x2="23" y2="8" /><line x1="21" y1="6" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/admin/marathon",
    label: "Marathon",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    href: "/admin/audit",
    label: "Audit Log",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="12" y2="17" />
      </svg>
    ),
  },
]

// Items visible only to SUPER_ADMIN — appended after the main nav.
const SUPER_ADMIN_NAV = [
  {
    href: "/admin/platform-team",
    label: "Platform Team",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
]

type NavItem = { href: string; exact?: boolean; label: string; icon: React.ReactNode }

const STORAGE_KEY = "admin-sidebar-collapsed"

export function AdminNav({ role }: { role: string | undefined }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)          // mobile drawer
  const [collapsed, setCollapsed] = useState(false) // desktop icon-rail

  // Restore the desktop collapsed preference after hydration. A one-time sync
  // from localStorage (which is unavailable during SSR) — not a render loop.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true)
  }, [])

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
      return next
    })

  const renderItem = ({ href, exact, label, icon }: NavItem, isCollapsed: boolean) => {
    const active = exact ? pathname === href : pathname.startsWith(href)
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setOpen(false)}
        title={isCollapsed ? label : undefined}
        className={cn(
          "flex items-center rounded-xl text-sm font-medium transition",
          isCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
          active
            ? "bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
        )}
      >
        {icon}
        {!isCollapsed && <span className="truncate">{label}</span>}
      </Link>
    )
  }

  const renderLinks = (isCollapsed: boolean) => (
    <nav className="space-y-1">
      {NAV.map((item) => renderItem(item, isCollapsed))}
      {isFounderTier(role) && (
        <>
          {isCollapsed ? (
            <div className="mx-2 my-3 border-t border-slate-200 dark:border-slate-800" />
          ) : (
            <p className="mt-6 mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-rose-500">
              Oversight
            </p>
          )}
          {SUPER_ADMIN_NAV.map((item) => renderItem(item, isCollapsed))}
        </>
      )}
    </nav>
  )

  const renderBrand = (isCollapsed: boolean) =>
    isCollapsed ? (
      <div className="mb-6 flex justify-center">
        <Link href="/admin" title="MCQ MasterLoop Admin" className="text-base font-black tracking-tight text-slate-900 dark:text-slate-100">
          MC<span className="text-lime-600">Q</span>
        </Link>
      </div>
    ) : (
      <div className="mb-6">
        <Link href="/admin" className="text-lg font-black text-slate-900 dark:text-slate-100">
          MCQ<span className="text-lime-600"> MasterLoop</span>
          <span className="ml-2 rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-300">
            Admin
          </span>
        </Link>
        {isFounderTier(role) && (
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-rose-500">
            {roleLabel(role)}
          </p>
        )}
      </div>
    )

  return (
    <>
      {/* Desktop sidebar — persists from `md` up (reduced windows keep it); collapses to an icon rail. */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white p-4 transition-[width] duration-200 dark:border-slate-800 dark:bg-slate-900 md:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        {renderBrand(collapsed)}
        {renderLinks(collapsed)}
        <div className="mt-auto space-y-1 pt-6">
          <Link
            href="/settings"
            title="Settings"
            className={cn(
              "flex items-center rounded-lg p-2 text-xs font-medium text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300",
              collapsed ? "justify-center" : "gap-2",
            )}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {!collapsed && "Settings"}
          </Link>
          <Link
            href="/practice"
            title="Back to app"
            className={cn(
              "flex items-center rounded-lg p-2 text-xs font-medium text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300",
              collapsed ? "justify-center" : "gap-2",
            )}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
            {!collapsed && "Back to app"}
          </Link>
          {collapsed ? (
            <>
              <button
                onClick={toggleCollapsed}
                title="Expand sidebar"
                aria-label="Expand sidebar"
                className="flex w-full items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                title="Sign out"
                aria-label="Sign out"
                className="flex w-full items-center justify-center rounded-lg p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                title="Sign out"
                aria-label="Sign out"
                className="flex flex-1 items-center gap-2 rounded-lg p-2 text-xs font-medium text-rose-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign out
              </button>
              <button
                onClick={toggleCollapsed}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
                className="flex shrink-0 items-center rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile top bar (below md) */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 md:hidden">
        <Link href="/admin" className="text-base font-black text-slate-900 dark:text-slate-100">
          MCQ<span className="text-lime-600"> MasterLoop</span>{" "}
          <span className="rounded bg-slate-800 px-1 py-0.5 text-[9px] font-bold uppercase text-slate-300">Admin</span>
        </Link>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            {open
              ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
              : <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>}
          </svg>
        </button>
      </div>

      {/* Mobile drawer (below md) */}
      {open && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute left-0 top-13.25 w-64 border-r border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {renderLinks(false)}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="mt-4 flex w-full items-center gap-2 rounded-lg p-2 text-sm font-medium text-rose-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </>
  )
}
