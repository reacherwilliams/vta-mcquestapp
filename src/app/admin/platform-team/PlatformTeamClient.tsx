"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { canGrantRole } from "@/lib/permissions"

type ReviewerInfo = {
  subjects:  { id: string; name: string; curriculumCode: string }[]
  curricula: { id: string; code: string; displayName: string }[]
  assignmentIds: { subject: Record<string, string>; curriculum: Record<string, string> }
}

type Member = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string         // SUPER_ADMIN | ADMIN | CONTRIBUTOR
  status: string       // ACTIVE | PENDING | SUSPENDED | DELETED
  lastLoginAt: string | null
  questionCount: number
  reviewCount: number
  reviewer: ReviewerInfo | null
}

type Curriculum = { id: string; code: string; displayName: string }
type Subject    = { id: string; name: string; curriculumId: string; curriculumCode: string }

type Props = {
  team:       Member[]
  curricula:  Curriculum[]
  subjects:   Subject[]
  viewerRole: string   // the signed-in user's role — gates which roles they may assign
}

// Every assignable role. Each surface filters this down to what the viewer is
// actually allowed to grant (canGrantRole), so nobody sees roles above their level.
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "CONTRIBUTOR", label: "Contributor" },
  { value: "ADMIN",       label: "Admin" },
  { value: "CO_FOUNDER",  label: "Co-Founder" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "STUDENT",     label: "→ Demote to Student" },
]

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  CO_FOUNDER:  "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
  ADMIN:       "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  CONTRIBUTOR: "bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400",
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  CO_FOUNDER:  "Co-Founder",
  ADMIN:       "Admin",
  CONTRIBUTOR: "Contributor",
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  PENDING:   "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  SUSPENDED: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  DELETED:   "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500",
}

type Tab = "admins" | "reviewers" | "contributors"

export function PlatformTeamClient({ team, curricula, subjects, viewerRole }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showInvite, setShowInvite] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [assignPrefillUserId, setAssignPrefillUserId] = useState<string | null>(null)
  const [busyRowId, setBusyRowId] = useState<string | null>(null)

  function openAssignFor(userId: string | null) {
    setAssignPrefillUserId(userId)
    setShowAssign(true)
  }

  const tabParam = (searchParams.get("tab") ?? "admins") as Tab
  const tab: Tab = ["admins", "reviewers", "contributors"].includes(tabParam) ? tabParam : "admins"

  useEffect(() => {
    const action = searchParams.get("action")
    if (action === "invite" && !showInvite) setShowInvite(true)
    if (action === "assign" && !showAssign) setShowAssign(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function clearActionParam() {
    if (searchParams.get("action")) {
      const p = new URLSearchParams(searchParams.toString())
      p.delete("action")
      router.replace(`/admin/platform-team${p.toString() ? `?${p.toString()}` : ""}`)
    }
  }

  function closeInvite() { setShowInvite(false); clearActionParam() }
  function closeAssign() { setShowAssign(false); setAssignPrefillUserId(null); clearActionParam() }

  async function changeRole(id: string, role: string) {
    setBusyRowId(id)
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    setBusyRowId(null)
    router.refresh()
  }

  async function changeStatus(id: string, status: string) {
    setBusyRowId(id)
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    setBusyRowId(null)
    router.refresh()
  }

  const admins       = team.filter((m) => m.role === "ADMIN" || m.role === "SUPER_ADMIN" || m.role === "CO_FOUNDER")
  const reviewers    = team.filter((m) => m.reviewer && (m.reviewer.subjects.length > 0 || m.reviewer.curricula.length > 0))
  const contributors = team.filter((m) => m.role === "CONTRIBUTOR" && !reviewers.find((r) => r.id === m.id))

  function tabHref(t: Tab) {
    const p = new URLSearchParams()
    p.set("tab", t)
    return `/admin/platform-team?${p.toString()}`
  }

  const TILES: { key: Tab; label: string; count: number }[] = [
    { key: "admins",       label: "Admins",       count: admins.length },
    { key: "reviewers",    label: "Reviewers",    count: reviewers.length },
    { key: "contributors", label: "Contributors", count: contributors.length },
  ]

  const activeMembers = tab === "admins" ? admins : tab === "reviewers" ? reviewers : contributors

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Platform Team</h1>
        <div className="flex items-center gap-2">
          {tab === "reviewers" && (
            <button
              onClick={() => openAssignFor(null)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              + Assign Reviewer
            </button>
          )}
          <button
            onClick={() => setShowInvite(true)}
            className="rounded-xl border-b-4 border-lime-700 bg-lime-500 px-4 py-2 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2"
          >
            + Invite Team Member
          </button>
        </div>
      </div>

      {/* Summary tiles — also act as tab nav */}
      <div className="grid grid-cols-3 gap-3">
        {TILES.map(({ key, label, count }) => {
          const active = tab === key
          return (
            <Link
              key={key}
              href={tabHref(key)}
              className={[
                "flex items-center justify-between rounded-xl border px-4 py-2.5 transition",
                active
                  ? "border-lime-300 bg-lime-50 dark:border-lime-700 dark:bg-lime-950/20"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700",
              ].join(" ")}
            >
              <span className={[
                "text-xs font-semibold uppercase tracking-widest",
                active ? "text-lime-600 dark:text-lime-500" : "text-slate-400 dark:text-slate-500",
              ].join(" ")}>
                {label}
              </span>
              <span className={[
                "text-xl font-black tabular-nums",
                active ? "text-lime-700 dark:text-lime-400" : "text-slate-900 dark:text-slate-100",
              ].join(" ")}>
                {count}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Active section */}
      <Section
        members={activeMembers}
        busyRowId={busyRowId}
        viewerRole={viewerRole}
        onRole={changeRole}
        onStatus={changeStatus}
        onAssignClick={openAssignFor}
        router={router}
        setBusy={setBusyRowId}
      />

      {showInvite && <InviteSlideOver onClose={closeInvite} viewerRole={viewerRole} />}
      {showAssign && (
        <AssignReviewerSlideOver
          onClose={closeAssign}
          candidates={team}
          curricula={curricula}
          subjects={subjects}
          router={router}
          initialUserId={assignPrefillUserId}
        />
      )}
    </div>
  )
}

function Section({
  members, busyRowId, viewerRole, onRole, onStatus, onAssignClick, router, setBusy,
}: {
  members: Member[]
  busyRowId: string | null
  viewerRole: string
  onRole: (id: string, role: string) => Promise<void>
  onStatus: (id: string, status: string) => Promise<void>
  onAssignClick: (userId: string) => void
  router: ReturnType<typeof useRouter>
  setBusy: (id: string | null) => void
}) {
  return (
    <section>
      {members.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 py-6 text-center text-xs text-slate-400 dark:border-slate-700">
          None yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-800 dark:bg-slate-900/60">
                <th className="px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-400">Person</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-400">Role</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-400">Reviewer scope</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-400">Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {members.map((m) => (
                <Row
                  key={m.id}
                  m={m}
                  busy={busyRowId === m.id}
                  viewerRole={viewerRole}
                  onRole={onRole}
                  onStatus={onStatus}
                  onAssignClick={onAssignClick}
                  router={router}
                  setBusy={setBusy}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Row({
  m, busy, viewerRole, onRole, onStatus, onAssignClick, router, setBusy,
}: {
  m: Member
  busy: boolean
  viewerRole: string
  onRole: (id: string, role: string) => Promise<void>
  onStatus: (id: string, status: string) => Promise<void>
  onAssignClick: (userId: string) => void
  router: ReturnType<typeof useRouter>
  setBusy: (id: string | null) => void
}) {
  // The viewer may only manage a member whose current role they're allowed to
  // grant — i.e. someone at/below their own authority. Otherwise role AND status
  // are read-only (e.g. a co-founder can't change or suspend a super-admin).
  const canManageMember = canGrantRole(viewerRole, m.role)
  const roleOptions = ROLE_OPTIONS.filter((o) => canGrantRole(viewerRole, o.value))
  async function revokeReviewer(assignmentId: string) {
    setBusy(m.id)
    await fetch(`/api/admin/reviewers/${assignmentId}`, { method: "DELETE" })
    setBusy(null)
    router.refresh()
  }

  return (
    <>
      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 align-top">
        <td className="px-4 py-3">
          <p className="font-medium text-slate-800 dark:text-slate-200">{m.firstName} {m.lastName}</p>
          <p className="text-[11px] text-slate-400">{m.email}</p>
        </td>
        <td className="px-4 py-3">
          {canManageMember ? (
            <PillSelect
              disabled={busy}
              value={m.role}
              onChange={(v) => onRole(m.id, v)}
              colorClass={ROLE_BADGE[m.role] ?? ""}
              options={roleOptions}
            />
          ) : (
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_BADGE[m.role] ?? ""}`}>
              {ROLE_LABEL[m.role] ?? m.role}
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          {canManageMember ? (
            <PillSelect
              disabled={busy}
              value={m.status}
              onChange={(v) => onStatus(m.id, v)}
              colorClass={STATUS_BADGE[m.status] ?? ""}
              options={[
                { value: "ACTIVE",    label: "Active" },
                { value: "SUSPENDED", label: "Suspended" },
              ]}
            />
          ) : (
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[m.status] ?? ""}`}>
              {m.status.charAt(0) + m.status.slice(1).toLowerCase()}
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-1">
            {m.reviewer?.curricula.map((c) => (
              <Chip key={`c-${c.id}`} label={`Curr · ${c.code}`} onRemove={() => revokeReviewer(m.reviewer!.assignmentIds.curriculum[c.id])} />
            ))}
            {m.reviewer?.subjects.map((s) => (
              <Chip key={`s-${s.id}`} label={`Subj · ${s.name}`} onRemove={() => revokeReviewer(m.reviewer!.assignmentIds.subject[s.id])} />
            ))}
            <button
              onClick={() => onAssignClick(m.id)}
              className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
            >
              + Add
            </button>
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
          <p>{m.questionCount} questions · {m.reviewCount} reviews</p>
          {m.lastLoginAt && (
            <p className="mt-0.5 text-[10px] text-slate-400">
              Last login {new Date(m.lastLoginAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </p>
          )}
        </td>
      </tr>
    </>
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

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-lime-100 px-2 py-0.5 text-[10px] font-semibold text-lime-800 dark:bg-lime-950/40 dark:text-lime-400">
      {label}
      <button onClick={onRemove} className="text-lime-600 hover:text-lime-900 dark:hover:text-lime-200" title="Revoke">×</button>
    </span>
  )
}

// ── Invite slide-over (SA-scoped — can create any role) ──────────────────────

function InviteSlideOver({ onClose, viewerRole }: { onClose: () => void; viewerRole: string }) {
  const router = useRouter()
  const [firstName, setFirstName] = useState("")
  const [lastName,  setLastName]  = useState("")
  const [email,     setEmail]     = useState("")
  const [role,      setRole]      = useState("CONTRIBUTOR")
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [result,    setResult]    = useState<{ email: string; tempPassword: string } | null>(null)
  const [copied,    setCopied]    = useState(false)

  async function handleInvite() {
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, role }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Could not invite."); return }
      setResult({ email: data.email, tempPassword: data.tempPassword })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function copy() {
    if (!result) return
    await navigator.clipboard.writeText(`Email: ${result.email}\nTemporary password: ${result.tempPassword}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const canSubmit = !!firstName.trim() && !!lastName.trim() && !!email.trim() && !saving

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-100 flex-col bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-base font-bold text-slate-900 dark:text-slate-100">Invite Team Member</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Account is created directly. Temp password shown once — share out-of-band.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {result ? (
            <>
              <div className="rounded-xl border border-lime-200 bg-lime-50 p-4 dark:border-lime-800 dark:bg-lime-950/20">
                <p className="text-sm font-bold text-lime-800 dark:text-lime-400">Account created ✓</p>
                <p className="mt-1 text-xs text-lime-700 dark:text-lime-500">
                  Temporary password shown <strong>once</strong>. Already hashed in the database.
                </p>
              </div>
              <Field label="Email">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800">{result.email}</div>
              </Field>
              <Field label="Temporary password">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm select-all dark:border-slate-700 dark:bg-slate-800">{result.tempPassword}</div>
              </Field>
              <button onClick={copy} className="w-full rounded-xl border-b-4 border-lime-700 bg-lime-500 px-4 py-2 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2">
                {copied ? "Copied ✓" : "Copy credentials"}
              </button>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tip: after creating, you can assign reviewer scopes to this person inline on the team list.
              </p>
            </>
          ) : (
            <>
              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-400">{error}</div>
              )}
              <Field label="First name *"><input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" /></Field>
              <Field label="Last name *"><input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" /></Field>
              <Field label="Email *"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@example.com" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" /></Field>
              <Field label="Role *">
                <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                  {[
                    { value: "STUDENT",     label: "Student" },
                    { value: "CONTRIBUTOR", label: "Contributor" },
                    { value: "ADMIN",       label: "Admin" },
                    { value: "CO_FOUNDER",  label: "Co-Founder" },
                    { value: "SUPER_ADMIN", label: "Super Admin" },
                  ].filter((o) => canGrantRole(viewerRole, o.value)).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {role === "STUDENT" && (
                  <p className="mt-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    Students don&apos;t appear on Platform Team — find them on <Link href="/admin/users" className="text-lime-700 hover:underline dark:text-lime-400">/admin/users</Link>.
                  </p>
                )}
                {(role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER") && (
                  <p className="mt-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-400">
                    ⚠ {role === "SUPER_ADMIN"
                      ? "Super-admin can manage all admins, billing, and platform settings."
                      : role === "CO_FOUNDER"
                        ? "Co-Founder oversees admins & the Question Bank and can view finance (no money movement)."
                        : "Admin can manage all users, questions, and curricula."} Promote with care.
                  </p>
                )}
              </Field>
            </>
          )}
        </div>

        <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
              {result ? "Done" : "Cancel"}
            </button>
            {!result && (
              <button onClick={handleInvite} disabled={!canSubmit} className="rounded-xl border-b-4 border-lime-700 bg-lime-500 px-4 py-2 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? "Inviting…" : "Invite"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</label>
      {children}
    </div>
  )
}

// ── Bulk reviewer-assignment form ────────────────────────────────────────────
// Tier selector → cascading scope picker (one curriculum filters its subjects)
// → multi-select checkboxes → person picker → Assign N at once.

function AssignReviewerSlideOver({
  onClose, candidates, curricula, subjects, router, initialUserId,
}: {
  onClose: () => void
  candidates: Member[]
  curricula:  Curriculum[]
  subjects:   Subject[]
  router: ReturnType<typeof useRouter>
  initialUserId?: string | null
}) {
  const [tier, setTier] = useState<"CURRICULUM" | "SUBJECT">("CURRICULUM")
  const [filterCurriculumId, setFilterCurriculumId] = useState("")
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState(initialUserId ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  // Reset picks when switching tier or filter — stale IDs would be invalid.
  function setTierAndReset(t: "CURRICULUM" | "SUBJECT") {
    setTier(t); setPickedIds(new Set()); setFilterCurriculumId("")
  }
  function setFilterAndReset(id: string) {
    setFilterCurriculumId(id); setPickedIds(new Set())
  }

  function toggle(id: string) {
    setPickedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const visibleScopes: { id: string; label: string }[] =
    tier === "CURRICULUM"
      ? curricula.map((c) => ({ id: c.id, label: `${c.code} — ${c.displayName}` }))
      : filterCurriculumId
        ? subjects
            .filter((s) => s.curriculumId === filterCurriculumId)
            .map((s) => ({ id: s.id, label: s.name }))
        : []

  function selectAll() {
    setPickedIds(new Set(visibleScopes.map((s) => s.id)))
  }
  function clearAll() {
    setPickedIds(new Set())
  }

  async function handleAssign() {
    setError(null); setFlash(null); setSaving(true)
    try {
      const res = await fetch("/api/admin/reviewers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, scope: tier, ids: Array.from(pickedIds) }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Could not assign."); return }
      const created = data.created ?? 0
      const skipped = data.skipped ?? 0
      setFlash(
        created === 0
          ? `All ${skipped} selected scope(s) were already assigned.`
          : `Assigned ${created} scope${created === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped — already assigned)` : ""}.`,
      )
      setPickedIds(new Set()); setUserId("")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = !!userId && pickedIds.size > 0 && !saving

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-base font-bold text-slate-900 dark:text-slate-100">Assign Reviewer</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Pick the tier, choose scopes, assign them to one person.
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
          {/* Tier toggle */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Tier</label>
            <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-800">
              {(["CURRICULUM", "SUBJECT"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTierAndReset(t)}
                  className={[
                    "flex-1 rounded-md px-2 py-1 text-xs font-semibold transition",
                    tier === t
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400",
                  ].join(" ")}
                >
                  {t === "CURRICULUM" ? "Curriculum" : "Subject"}
                </button>
              ))}
            </div>
          </div>

          {/* Curriculum filter — only when tier=Subject */}
          {tier === "SUBJECT" && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Curriculum filter <span className="text-rose-500">*</span>
              </label>
              <select
                value={filterCurriculumId}
                onChange={(e) => setFilterAndReset(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">Choose curriculum…</option>
                {curricula.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.displayName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Reviewer (person) */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Reviewer <span className="text-rose-500">*</span>
            </label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">Choose person…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} ({ROLE_LABEL[c.role] ?? c.role.toLowerCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Multi-select checkboxes */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {tier === "CURRICULUM" ? "Curricula" : "Subjects"} <span className="text-rose-500">*</span>
              </label>
              {visibleScopes.length > 0 && (
                <div className="flex gap-3 text-[10px] font-semibold uppercase tracking-widest">
                  <button onClick={selectAll} className="text-lime-700 hover:underline dark:text-lime-400">All</button>
                  <button onClick={clearAll} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">None</button>
                </div>
              )}
            </div>
            {visibleScopes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400 dark:border-slate-700">
                {tier === "SUBJECT" ? "Pick a curriculum first." : "No curricula configured."}
              </p>
            ) : (
              <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/40">
                {visibleScopes.map((s) => {
                  const checked = pickedIds.has(s.id)
                  return (
                    <label
                      key={s.id}
                      className={[
                        "flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition",
                        checked
                          ? "border-lime-300 bg-lime-50 text-lime-900 dark:border-lime-700 dark:bg-lime-950/30 dark:text-lime-300"
                          : "border-transparent hover:bg-white dark:hover:bg-slate-800",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(s.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-lime-500 focus:ring-lime-500"
                      />
                      <span className="truncate font-medium text-slate-700 dark:text-slate-300">{s.label}</span>
                    </label>
                  )
                })}
              </div>
            )}
            <p className="mt-1 text-[10px] text-slate-400">
              {pickedIds.size > 0 ? `${pickedIds.size} selected` : "Select one or more."}
            </p>
          </div>

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-400">
              {error}
            </p>
          )}
          {flash && (
            <p className="rounded-lg border border-lime-200 bg-lime-50 px-3 py-2 text-xs text-lime-700 dark:border-lime-800/40 dark:bg-lime-950/20 dark:text-lime-400">
              {flash}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Close
            </button>
            <button
              onClick={handleAssign}
              disabled={!canSubmit}
              className="rounded-xl border-b-4 border-lime-700 bg-lime-500 px-4 py-2 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving
                ? "Assigning…"
                : pickedIds.size > 1
                  ? `Assign ${pickedIds.size} scopes`
                  : "Assign"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
