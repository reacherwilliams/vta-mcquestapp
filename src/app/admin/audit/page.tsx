import "server-only"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

type Props = { searchParams: Promise<{ q?: string; entity?: string; page?: string }> }

function isAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

const ENTITY_OPTIONS = ["", "Question", "User"]
const LIMIT = 40

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(d)
}

function actionBadge(action: string) {
  const map: Record<string, string> = {
    QUESTION_CREATED: "bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400",
    QUESTION_UPDATED: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
    QUESTION_STATUS_CHANGED: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    QUESTION_DELETED: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
    USER_ROLE_CHANGED: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
    USER_STATUS_CHANGED: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
    BULK_IMPORT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  }
  const cls = map[action] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {action.replace(/_/g, " ")}
    </span>
  )
}

export default async function AuditPage({ searchParams }: Props) {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) redirect("/admin")

  const { q = "", entity = "", page: pageStr = "1" } = await searchParams
  const page = Math.max(1, Number(pageStr))

  const where = {
    ...(q ? { action: { contains: q, mode: "insensitive" as const } } : {}),
    ...(entity ? { entity } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * LIMIT,
      take: LIMIT,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  const pages = Math.ceil(total / LIMIT)

  function pageUrl(p: number) {
    const sp = new URLSearchParams()
    if (q) sp.set("q", q)
    if (entity) sp.set("entity", entity)
    sp.set("page", String(p))
    return `/admin/audit?${sp.toString()}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Audit Log</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {total.toLocaleString()} event{total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search action…"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <select
          name="entity"
          defaultValue={entity}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-lime-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          {ENTITY_OPTIONS.map((e) => (
            <option key={e} value={e}>{e || "All entities"}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl bg-lime-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-lime-700"
        >
          Filter
        </button>
        {(q || entity) && (
          <Link
            href="/admin/audit"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {items.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500">No audit events found.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Time</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Actor</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Action</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Entity</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {fmtDate(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {log.user ? (
                      <>
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {log.user.firstName} {log.user.lastName}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500">{log.user.email}</div>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{actionBadge(log.action)}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{log.entity}</span>
                    {log.entityId && (
                      <div className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{log.entityId.slice(0, 8)}…</div>
                    )}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {JSON.stringify(log.metadata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={pageUrl(page - 1)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                ← Prev
              </Link>
            )}
            {page < pages && (
              <Link
                href={pageUrl(page + 1)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
