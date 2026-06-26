import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { QuestionsTable } from "./QuestionsTable"
import { CurriculumTab } from "./CurriculumTab"
import { SubjectsTab } from "./SubjectsTab"

export const metadata = { title: "Admin — Question Bank" }

const STATUS_TABS = [
  { key: "",                     label: "All" },
  { key: "DRAFT",                label: "Draft" },
  { key: "IN_SUBJECT_REVIEW",    label: "Subject Review" },
  { key: "IN_CURRICULUM_REVIEW", label: "Curriculum Review" },
  { key: "PUBLISHED",            label: "Published" },
  { key: "ARCHIVED",             label: "Archived" },
] as const

const DIFFICULTY_CHIPS = [
  { key: "",          label: "All",       color: "" },
  { key: "EASY",      label: "Easy",      color: "text-lime-700 dark:text-lime-400" },
  { key: "MEDIUM",    label: "Medium",    color: "text-sky-700 dark:text-sky-400" },
  { key: "HARD",      label: "Hard",      color: "text-orange-700 dark:text-orange-400" },
  { key: "CHALLENGE", label: "Challenge", color: "text-rose-700 dark:text-rose-400" },
] as const

type SearchParams = {
  tab?: string
  curriculumId?: string
  subjectId?: string
  status?: string
  difficulty?: string
  page?: string
}

type Props = { searchParams: Promise<SearchParams> }

export default async function QuestionBankPage({ searchParams }: Props) {
  const {
    tab = "questions",
    curriculumId = "",
    subjectId = "",
    status = "",
    difficulty = "",
    page: pageStr = "1",
  } = await searchParams

  const page = Math.max(1, Number(pageStr))
  const limit = 25

  // Always fetch summary counts + curricula for tab/filter data
  const [totalQuestions, totalSubjects, curricula] = await Promise.all([
    prisma.question.count(),
    prisma.subject.count(),
    prisma.curriculum.findMany({
      select: { id: true, code: true, displayName: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    }),
  ])

  // Tab-specific data
  let curriculaWithCounts: Awaited<ReturnType<typeof fetchCurriculaWithCounts>> | null = null
  let subjects: Awaited<ReturnType<typeof fetchSubjects>> | null = null
  let questionData: Awaited<ReturnType<typeof fetchQuestions>> | null = null

  if (tab === "curriculum") {
    curriculaWithCounts = await fetchCurriculaWithCounts()
  } else if (tab === "subjects") {
    subjects = await fetchSubjects(curriculumId)
  } else {
    questionData = await fetchQuestions({ status, subjectId, difficulty, page, limit })
  }

  // Helpers for building tab hrefs (preserve relevant params when switching)
  function tabHref(newTab: string) {
    const params = new URLSearchParams()
    params.set("tab", newTab)
    if (newTab !== "curriculum" && curriculumId) params.set("curriculumId", curriculumId)
    if (newTab === "questions") {
      if (subjectId) params.set("subjectId", subjectId)
      if (status) params.set("status", status)
    }
    return `/admin/questions?${params.toString()}`
  }

  function statusHref(s: string) {
    const params = new URLSearchParams()
    params.set("tab", "questions")
    if (s) params.set("status", s)
    if (subjectId) params.set("subjectId", subjectId)
    if (curriculumId) params.set("curriculumId", curriculumId)
    if (difficulty) params.set("difficulty", difficulty)
    return `/admin/questions?${params.toString()}`
  }

  function difficultyHref(d: string) {
    const params = new URLSearchParams()
    params.set("tab", "questions")
    if (status) params.set("status", status)
    if (subjectId) params.set("subjectId", subjectId)
    if (curriculumId) params.set("curriculumId", curriculumId)
    if (d) params.set("difficulty", d)
    return `/admin/questions?${params.toString()}`
  }

  const STAT_TILES = [
    { key: "curriculum", label: "Curricula",  value: curricula.length,            href: tabHref("curriculum") },
    { key: "subjects",   label: "Subjects",   value: totalSubjects,               href: tabHref("subjects")   },
    { key: "questions",  label: "Questions",  value: totalQuestions,              href: tabHref("questions")  },
  ]

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Question Bank</h1>
        {tab === "curriculum" && (
          <Link
            href={`/admin/questions?tab=curriculum&action=add`}
            className="rounded-xl border-b-4 border-lime-700 bg-lime-500 px-4 py-2 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2"
          >
            + Add Curriculum
          </Link>
        )}
        {tab === "subjects" && (
          <Link
            href={`/admin/questions?tab=subjects${curriculumId ? `&curriculumId=${curriculumId}` : ""}&action=add`}
            className="rounded-xl border-b-4 border-lime-700 bg-lime-500 px-4 py-2 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2"
          >
            + Add Subject
          </Link>
        )}
        {tab === "questions" && (
          <Link
            href="/admin/questions/new"
            className="rounded-xl border-b-4 border-lime-700 bg-lime-500 px-4 py-2 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2"
          >
            + New Question
          </Link>
        )}
      </div>

      {/* Summary tiles — also serve as tab nav */}
      <div className="grid grid-cols-3 gap-3">
        {STAT_TILES.map(({ key, label, value, href }) => {
          const active = tab === key
          return (
            <Link
              key={key}
              href={href}
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
                {value.toLocaleString()}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === "curriculum" && curriculaWithCounts && (
        <CurriculumTab
          curricula={curriculaWithCounts}
        />
      )}

      {tab === "subjects" && subjects !== null && (
        <SubjectsTab
          subjects={subjects}
          curricula={curricula}
          curriculumId={curriculumId}
        />
      )}

      {tab === "questions" && questionData && (
        <div className="space-y-4">
          {/* Status tabs + Difficulty chips — single row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
              {STATUS_TABS.map(({ key, label }) => {
                const active = status === key
                return (
                  <Link
                    key={key}
                    href={statusHref(key)}
                    className={[
                      "flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-semibold transition whitespace-nowrap",
                      active
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                    ].join(" ")}
                  >
                    {label}
                  </Link>
                )
              })}
            </div>
            {/* Difficulty chips */}
            <div className="flex items-center gap-1">
              {DIFFICULTY_CHIPS.map(({ key, label, color }) => {
                const active = difficulty === key
                return (
                  <Link
                    key={key}
                    href={difficultyHref(key)}
                    className={[
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                      active
                        ? key === "" ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                          : `bg-slate-100 dark:bg-slate-800 ${color}`
                        : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300",
                    ].join(" ")}
                  >
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>

          <QuestionsTable
            items={questionData.items as Parameters<typeof QuestionsTable>[0]["items"]}
            page={questionData.page}
            pages={questionData.pages}
          />
        </div>
      )}
    </div>
  )
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchCurriculaWithCounts() {
  const curricula = await prisma.curriculum.findMany({
    include: {
      _count: { select: { subjects: true } },
      subjects: {
        select: { _count: { select: { questions: true } } },
      },
    },
    orderBy: { sortOrder: "asc" },
  })

  return curricula.map((c) => ({
    id: c.id,
    code: c.code as string,
    displayName: c.displayName,
    description: c.description,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    _count: { subjects: c._count.subjects },
    questionCount: c.subjects.reduce((sum, s) => sum + s._count.questions, 0),
  }))
}

async function fetchSubjects(curriculumId: string) {
  return prisma.subject.findMany({
    where: curriculumId ? { curriculumId } : undefined,
    include: {
      curriculum: { select: { id: true, code: true, displayName: true } },
      _count: { select: { chapters: true, questions: true } },
    },
    orderBy: [{ curriculum: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  })
}

async function fetchQuestions({
  status,
  subjectId,
  difficulty,
  page,
  limit,
}: {
  status: string
  subjectId: string
  difficulty: string
  page: number
  limit: number
}) {
  const VALID_DIFFICULTIES = ["EASY", "MEDIUM", "HARD", "CHALLENGE"]
  const where = {
    ...(status ? { status: status as "DRAFT" | "IN_SUBJECT_REVIEW" | "IN_CURRICULUM_REVIEW" | "PUBLISHED" | "ARCHIVED" } : {}),
    ...(subjectId ? { subjectId } : {}),
    ...(difficulty && VALID_DIFFICULTIES.includes(difficulty)
      ? { difficulty: difficulty as "EASY" | "MEDIUM" | "HARD" | "CHALLENGE" }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      select: {
        id: true, stem: true, difficulty: true, status: true, year: true,
        aiAssisted: true, createdAt: true,
        subject: { select: { name: true, code: true, curriculum: { select: { code: true, displayName: true } } } },
        chapter: { select: { name: true } },
        author: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.question.count({ where }),
  ])

  return { items, total, page, pages: Math.ceil(total / limit) }
}
