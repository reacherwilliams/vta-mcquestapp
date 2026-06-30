import "server-only"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminTier } from "@/lib/permissions"
import { CoverageTree, type CoverageNode } from "./CoverageTree"

export const metadata = { title: "Admin — Coverage" }

type SearchParams = Promise<{ subjectId?: string }>

// Questions that are live vs. still working through the review pipeline.
const PIPELINE_STATUSES = ["DRAFT", "IN_SUBJECT_REVIEW", "IN_CURRICULUM_REVIEW", "IN_QA"] as const

export default async function CoveragePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!isAdminTier(session.user.role)) redirect("/admin")

  const { subjectId: rawSubjectId } = await searchParams

  const subjects = await prisma.subject.findMany({
    where: { isActive: true },
    select: { id: true, name: true, curriculum: { select: { code: true, displayName: true, sortOrder: true } } },
    orderBy: [{ curriculum: { sortOrder: "asc" } }, { name: "asc" }],
  })

  // Default to the first subject that actually has a topic tree.
  const subjectId = rawSubjectId && subjects.some((s) => s.id === rawSubjectId)
    ? rawSubjectId
    : subjects[0]?.id ?? ""

  const subject = subjects.find((s) => s.id === subjectId)

  const [topics, grouped, untaggedLive, untaggedPipeline] = subjectId
    ? await Promise.all([
        prisma.topic.findMany({
          where: { subjectId },
          select: { id: true, parentId: true, code: true, title: true, level: true, examWeight: true, sortOrder: true },
          orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
        }),
        prisma.question.groupBy({
          by: ["topicId", "status"],
          where: { subjectId, topicId: { not: null } },
          _count: { _all: true },
        }),
        prisma.question.count({ where: { subjectId, topicId: null, status: "PUBLISHED" } }),
        prisma.question.count({ where: { subjectId, topicId: null, status: { in: [...PIPELINE_STATUSES] } } }),
      ])
    : [[], [], 0, 0] as const

  // Own (directly-tagged) counts per topic.
  const ownLive = new Map<string, number>()
  const ownPipe = new Map<string, number>()
  for (const g of grouped) {
    if (!g.topicId) continue
    const n = g._count._all
    if (g.status === "PUBLISHED") ownLive.set(g.topicId, (ownLive.get(g.topicId) ?? 0) + n)
    else if ((PIPELINE_STATUSES as readonly string[]).includes(g.status)) ownPipe.set(g.topicId, (ownPipe.get(g.topicId) ?? 0) + n)
  }

  // children-of map, preserving the query's sort order.
  const childrenOf = new Map<string | null, string[]>()
  for (const t of topics) {
    const arr = childrenOf.get(t.parentId) ?? []
    arr.push(t.id)
    childrenOf.set(t.parentId, arr)
  }

  // Subtree rollups: a topic's count includes everything tagged beneath it.
  const memo = new Map<string, { live: number; pipe: number }>()
  function rollup(id: string): { live: number; pipe: number } {
    const cached = memo.get(id)
    if (cached) return cached
    let live = ownLive.get(id) ?? 0
    let pipe = ownPipe.get(id) ?? 0
    for (const c of childrenOf.get(id) ?? []) {
      const s = rollup(c)
      live += s.live
      pipe += s.pipe
    }
    const r = { live, pipe }
    memo.set(id, r)
    return r
  }

  // Pre-order flatten (parent before its children) with depth, for tree display.
  const byId = new Map(topics.map((t) => [t.id, t]))
  const nodes: CoverageNode[] = []
  function walk(id: string, depth: number) {
    const t = byId.get(id)!
    const kids = childrenOf.get(id) ?? []
    const sub = rollup(id)
    nodes.push({
      id: t.id,
      parentId: t.parentId,
      code: t.code,
      title: t.title,
      depth,
      hasChildren: kids.length > 0,
      live: sub.live,
      pipeline: sub.pipe,
      examWeight: t.examWeight,
    })
    for (const c of kids) walk(c, depth + 1)
  }
  for (const r of childrenOf.get(null) ?? []) walk(r, 0)

  const totalLive = nodes.reduce((acc, n) => acc + (n.depth === 0 ? n.live : 0), 0) + untaggedLive
  const gaps = nodes.filter((n) => !n.hasChildren && n.live === 0).length

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">Syllabus coverage</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Published questions mapped onto the topic tree — find the gaps before they bite a learner.
        </p>
      </header>

      {/* Subject picker */}
      <form className="mb-6">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</label>
        <select
          name="subjectId"
          defaultValue={subjectId}
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.curriculum.code} · {s.name}</option>
          ))}
        </select>
        <button type="submit" className="ml-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          View
        </button>
      </form>

      {!subjectId ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">No active subjects yet.</p>
      ) : nodes.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          {subject?.name} has no imported topic tree yet — import one to track coverage.
        </p>
      ) : (
        <>
          {/* Summary strip */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Live questions" value={totalLive} />
            <Stat label="Topics" value={nodes.length} />
            <Stat label="Leaf gaps" value={gaps} tone={gaps > 0 ? "warn" : "ok"} />
            <Stat label="Untagged" value={untaggedLive + untaggedPipeline} tone={untaggedLive + untaggedPipeline > 0 ? "muted" : "ok"} />
          </div>

          <CoverageTree nodes={nodes} />

          {(untaggedLive + untaggedPipeline > 0) && (
            <p className="mt-4 text-xs text-slate-400">
              {untaggedLive + untaggedPipeline} question{untaggedLive + untaggedPipeline === 1 ? "" : "s"} in {subject?.name} have no syllabus topic
              ({untaggedLive} live, {untaggedPipeline} in pipeline) — tag them to count toward coverage.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, tone = "ok" }: { label: string; value: number; tone?: "ok" | "warn" | "muted" }) {
  const color = tone === "warn" ? "text-amber-600 dark:text-amber-400" : tone === "muted" ? "text-slate-400" : "text-slate-900 dark:text-slate-100"
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className={`text-2xl font-black ${color}`}>{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  )
}
