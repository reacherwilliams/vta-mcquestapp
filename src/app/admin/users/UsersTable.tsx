"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition, useEffect } from "react"

type UserItem = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  status: string
  emailVerified: Date | null
  createdAt: Date
  lastLoginAt: Date | null
  _count: { attempts: number }
}

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  CO_FOUNDER:  "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
  ADMIN:       "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  CONTRIBUTOR: "bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400",
  STUDENT:     "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  PENDING:   "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  SUSPENDED: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  DELETED:   "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500",
}

export function UsersTable({
  items, page, pages, q, role, status, isSuperAdmin,
}: {
  items: UserItem[]
  page: number
  pages: number
  q: string
  role: string
  status: string
  isSuperAdmin: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState<string | null>(null)
  const [pendingRole, setPendingRole] = useState<Record<string, string>>({})
  const [pendingStatus, setPendingStatus] = useState<Record<string, string>>({})
  const [showInvite, setShowInvite] = useState(false)

  // Open the Invite slide-over when the heading button sets ?action=invite
  useEffect(() => {
    if (searchParams.get("action") === "invite" && !showInvite) {
      setShowInvite(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function closeInvite() {
    setShowInvite(false)
    if (searchParams.get("action")) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("action")
      router.replace(`/admin/users${params.toString() ? `?${params.toString()}` : ""}`)
    }
  }

  async function applyChange(id: string, payload: { role?: string; status?: string }) {
    setEditing(id)
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setEditing(null)
    startTransition(() => router.refresh())
  }

  function buildHref(params: Record<string, string>) {
    const p = new URLSearchParams()
    if (params.q ?? q) p.set("q", params.q ?? q)
    if (params.role ?? role) p.set("role", params.role ?? role)
    if (params.status ?? status) p.set("status", params.status ?? status)
    if (params.page) p.set("page", params.page)
    const s = p.toString()
    return `/admin/users${s ? `?${s}` : ""}`
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    router.push(buildHref({ q: fd.get("q") as string, page: "1" }))
  }

  return (
    <div className="space-y-4">
      {/* Search + role/status filters */}
      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or email…"
            className="w-64 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-600"
          />
          <button type="submit" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Search
          </button>
        </form>
        <select
          value={role}
          onChange={(e) => router.push(buildHref({ role: e.target.value, page: "1" }))}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
        >
          <option value="">All roles</option>
          <option value="STUDENT">Student</option>
          <option value="CONTRIBUTOR">Contributor</option>
          <option value="ADMIN">Admin</option>
          <option value="CO_FOUNDER">Co-Founder</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
        <select
          value={status}
          onChange={(e) => router.push(buildHref({ status: e.target.value, page: "1" }))}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DELETED">Deleted</option>
        </select>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-400 dark:border-slate-700">
          No users found
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-800 dark:bg-slate-900/60">
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">User</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Role</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Activity</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Joined</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {items.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-[11px] text-slate-400">{u.email}</p>
                    {!u.emailVerified && (
                      <span className="text-[10px] font-semibold text-amber-500">unverified</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <PillSelect
                      disabled={editing === u.id}
                      value={pendingRole[u.id] ?? u.role}
                      onChange={(v) => {
                        setPendingRole((p) => ({ ...p, [u.id]: v }))
                        applyChange(u.id, { role: v })
                      }}
                      colorClass={ROLE_BADGE[u.role] ?? ""}
                      options={[
                        { value: "STUDENT",     label: "Student" },
                        { value: "CONTRIBUTOR", label: "Contributor" },
                        ...(isSuperAdmin
                          ? [
                              { value: "ADMIN",       label: "Admin" },
                              { value: "CO_FOUNDER",  label: "Co-Founder" },
                              { value: "SUPER_ADMIN", label: "Super Admin" },
                            ]
                          : []),
                      ]}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <PillSelect
                      disabled={editing === u.id}
                      value={pendingStatus[u.id] ?? u.status}
                      onChange={(v) => {
                        setPendingStatus((p) => ({ ...p, [u.id]: v }))
                        applyChange(u.id, { status: v })
                      }}
                      colorClass={STATUS_BADGE[u.status] ?? ""}
                      options={[
                        { value: "ACTIVE",    label: "Active" },
                        { value: "PENDING",   label: "Pending" },
                        { value: "SUSPENDED", label: "Suspended" },
                        { value: "DELETED",   label: "Deleted" },
                      ]}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {u._count.attempts.toLocaleString()} attempts
                    {u.lastLoginAt && (
                      <p className="text-[10px] text-slate-400">
                        Last: {new Date(u.lastLoginAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    {editing === u.id && (
                      <span className="text-xs text-slate-400">Saving…</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">Page {page} of {pages}</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildHref({ page: String(page - 1) })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                ← Prev
              </Link>
            )}
            {page < pages && (
              <Link href={buildHref({ page: String(page + 1) })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}

      {showInvite && <InviteSlideOver onClose={closeInvite} isSuperAdmin={isSuperAdmin} />}
    </div>
  )
}

// ── Invite slide-over ───────────────────────────────────────────────────────

function InviteSlideOver({ onClose, isSuperAdmin }: { onClose: () => void; isSuperAdmin: boolean }) {
  const router = useRouter()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("STUDENT")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleInvite() {
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, role }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Could not invite user.")
        return
      }
      setResult({ email: data.email, tempPassword: data.tempPassword })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function copy() {
    if (!result) return
    await navigator.clipboard.writeText(`Email: ${result.email}\nTemporary password: ${result.tempPassword}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const canSubmit = !!firstName.trim() && !!lastName.trim() && !!email.trim() && !!role && !saving

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-100 flex-col bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-base font-bold text-slate-900 dark:text-slate-100">Invite User</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Creates the account directly. A temp password is shown once — share it with the user out-of-band.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {result ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-lime-200 bg-lime-50 p-4 dark:border-lime-800 dark:bg-lime-950/20">
                <p className="text-sm font-bold text-lime-800 dark:text-lime-400">User created ✓</p>
                <p className="mt-1 text-xs text-lime-700 dark:text-lime-500">
                  Share the credentials below with the new user. The password is shown <strong>once</strong> — it&apos;s already hashed in the database.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Email</label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800">
                  {result.email}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Temporary password</label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm select-all dark:border-slate-700 dark:bg-slate-800">
                  {result.tempPassword}
                </div>
              </div>
              <button
                onClick={copy}
                className="w-full rounded-xl border-b-4 border-lime-700 bg-lime-500 px-4 py-2 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2"
              >
                {copied ? "Copied ✓" : "Copy credentials"}
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-400">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  First name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Last name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="person@example.com"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="STUDENT">Student</option>
                  <option value="CONTRIBUTOR">Contributor</option>
                  {isSuperAdmin && <option value="ADMIN">Admin</option>}
                  {isSuperAdmin && <option value="CO_FOUNDER">Co-Founder</option>}
                  {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
                </select>
                {!isSuperAdmin && (
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                    Only a super-admin can create Admin or Super Admin accounts.
                  </p>
                )}
                {role === "CONTRIBUTOR" && (
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Skips the public application flow. Use <Link href="/admin/contributors" className="text-lime-700 hover:underline dark:text-lime-400">/admin/contributors</Link> instead if you want to review their application first.
                  </p>
                )}
                {(role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER") && (
                  <p className="mt-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-400">
                    ⚠ Admin accounts can manage all users, questions, and curricula. Promote with care.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {result ? "Done" : "Cancel"}
            </button>
            {!result && (
              <button
                onClick={handleInvite}
                disabled={!canSubmit}
                className="rounded-xl border-b-4 border-lime-700 bg-lime-500 px-4 py-2 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Inviting…" : "Invite"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Rounded "badge" select with a custom chevron — using a wrapper span + absolutely
// positioned SVG so we don't fight the browser's native arrow rendering across
// Chrome/Safari/Firefox.
function PillSelect({
  value, onChange, options, colorClass, disabled,
}: {
  value: string
  onChange: (next: string) => void
  options: { value: string; label: string }[]
  colorClass: string
  disabled?: boolean
}) {
  return (
    <span className={`relative inline-flex items-center rounded-full ${colorClass}`}>
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title="Click to change"
        className="appearance-none bg-transparent rounded-full pl-2.5 pr-6 py-0.5 text-[10px] font-semibold uppercase tracking-wide border-0 outline-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <svg
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="pointer-events-none absolute right-1.5 h-2.5 w-2.5 opacity-70"
      >
        <polyline points="3 5 6 8 9 5" />
      </svg>
    </span>
  )
}
