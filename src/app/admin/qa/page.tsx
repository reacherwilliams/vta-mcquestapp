import "server-only"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminTier } from "@/lib/permissions"
import type { DemoQuestion, DemoOption } from "@/lib/questions/demo-data"
import type { ContentBlock, QuestionStem, Explanation } from "@/lib/questions/types"
import { QaClient } from "./QaClient"

export const metadata = { title: "Admin — QA Testing" }

type SearchParams = Promise<{ status?: string; curriculumId?: string; subjectId?: string }>

// Only these two pools are testable: awaiting-QA and already-live.
function resolveStatus(raw: string | undefined): "IN_QA" | "PUBLISHED" {
  return raw === "PUBLISHED" ? "PUBLISHED" : "IN_QA"
}

function stemPreview(stem: unknown): string {
  if (!Array.isArray(stem)) return "—"
  for (const block of stem) {
    if ((block?.kind === "text" || block?.type === "text") && block?.text) {
      return String(block.text).slice(0, 120)
    }
  }
  return "(no text — image/graph stem)"
}

export default async function QaPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!isAdminTier(session.user.role)) redirect("/admin")
  const isSuperAdmin = session.user.role === "SUPER_ADMIN"

  const { status: rawStatus, curriculumId, subjectId } = await searchParams
  const status = resolveStatus(rawStatus)

  const [rows, subjects, curricula] = await Promise.all([
    prisma.question.findMany({
      where: {
        status,
        ...(subjectId
          ? { subjectId }
          : curriculumId
            ? { subject: { curriculumId } }
            : {}),
      },
      include: {
        subject: { include: { curriculum: true } },
        chapter: true,
        options: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.subject.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, syllabusCode: true, curriculum: { select: { id: true, code: true } } },
      orderBy: [{ curriculum: { sortOrder: "asc" } }, { name: "asc" }],
    }),
    prisma.curriculum.findMany({
      where: { isActive: true },
      select: { id: true, code: true, displayName: true },
      orderBy: { sortOrder: "asc" },
    }),
  ])

  const items = rows.map((q) => ({
    id: q.id,
    status: q.status,
    subjectName: q.subject.name,
    chapterName: q.chapter.name,
    difficulty: q.difficulty as string,
    stemPreview: stemPreview(q.stem),
    simScore: q.simScore,
    simCitation: q.simCitation,
    simOriginalId: q.simOriginalId,
    simChecked: q.simCheckedAt != null,
    display: {
      id: q.id,
      curriculum: q.subject.curriculum.code,
      subject: q.subject.name,
      chapter: q.chapter.name,
      difficulty: q.difficulty as DemoQuestion["difficulty"],
      tags: q.tags as string[],
      stem: q.stem as QuestionStem,
      explanation: (q.explanation ?? []) as Explanation,
      allowMultipleCorrect: q.allowMultipleCorrect,
      options: q.options.map((o) => ({
        id: o.id,
        content: o.content as ContentBlock,
        isCorrect: o.isCorrect,
        rationale: o.rationale ?? undefined,
      })) as DemoOption[],
    } satisfies DemoQuestion,
  }))

  return (
    <QaClient
      items={items}
      curricula={curricula}
      subjects={subjects.map((s) => ({ id: s.id, name: s.name, code: s.code, syllabusCode: s.syllabusCode, curriculumId: s.curriculum.id, curriculumCode: s.curriculum.code }))}
      status={status}
      curriculumId={curriculumId ?? ""}
      subjectId={subjectId ?? ""}
      cappedAt={rows.length === 100 ? 100 : null}
      isSuperAdmin={isSuperAdmin}
    />
  )
}
