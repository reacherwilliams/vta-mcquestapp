import Link from "next/link"
import { resolveAccent } from "@/lib/accents"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getEntitledSubjectScope } from "@/lib/entitlements"
import { FilterClient } from "./FilterClient"

export const metadata = { title: "Choose your topic" }

type SearchParams = Promise<{ style?: string; accent?: string }>

function resolveStyle(raw: string | undefined): "duo" | "swiss" {
  return raw === "swiss" ? "swiss" : "duo"
}

export default async function FilterPage({ searchParams }: { searchParams: SearchParams }) {
  const { style, accent } = await searchParams
  const styleKey = resolveStyle(style)
  const accentKey = resolveAccent(accent)

  const session = await auth()
  const isAuthenticated = !!session?.user?.id

  // For authenticated users, load subject/chapter data from DB
  let dbSubjects: {
    id: string
    curriculumCode: string
    curriculumName: string
    name: string
    chapters: { id: string; name: string }[]
  }[] = []

  if (isAuthenticated) {
    try {
      // Restrict to the student's entitled subjects (null = unrestricted: gate
      // off, admin, or grandfathered). Enforcement also lives in the session
      // builder; this just keeps the picker honest.
      const scope = await getEntitledSubjectScope(session!.user!.id, session!.user!.role as string | undefined)
      const subjects = await prisma.subject.findMany({
        where: { isActive: true, ...(scope !== null ? { id: { in: scope } } : {}) },
        include: {
          curriculum: { select: { code: true, displayName: true } },
          chapters: {
            where: { isActive: true },
            select: { id: true, name: true, ibLevel: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: [{ curriculum: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      })
      dbSubjects = subjects.map((s) => ({
        id: s.id,
        curriculumCode: s.curriculum.code,
        curriculumName: s.curriculum.displayName,
        name: s.name,
        chapters: s.chapters.map((c) => ({ id: c.id, name: c.name, ibLevel: c.ibLevel ?? null })),
        hasFrq: s.hasFrq,
      }))
    } catch {
      // DB unavailable — fall back to demo mode silently
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <header className="border-b border-slate-100 dark:border-slate-900">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-4 px-6 py-3 sm:px-10">
          <Link
            href={isAuthenticated ? "/practice" : "/"}
            aria-label="Exit"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-2xl font-light leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ×
          </Link>
          <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Choose your topic
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8 sm:px-10">
        {!isAuthenticated && (
          <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Using demo questions —{" "}
            <Link href="/register" className="font-semibold underline underline-offset-2">
              create a free account
            </Link>{" "}
            to unlock the full question bank and track your progress.
          </p>
        )}
        <FilterClient
          accent={accentKey}
          style={styleKey}
          isAuthenticated={isAuthenticated}
          dbSubjects={dbSubjects}
        />
      </main>
    </div>
  )
}
