import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { QuestionEditor } from "../../QuestionEditor"
import type { ContentBlock } from "@/lib/questions/types"

export const metadata = { title: "Admin — Edit Question" }

type Props = { params: Promise<{ id: string }> }

export default async function EditQuestionPage({ params }: Props) {
  const { id } = await params

  const [question, subjects] = await Promise.all([
    prisma.question.findUnique({
      where: { id },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        chapter: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
      },
    }),
    prisma.subject.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, code: true, curriculumId: true,
        curriculum: { select: { code: true, displayName: true } },
      },
      orderBy: [{ curriculum: { sortOrder: "asc" } }, { name: "asc" }],
    }),
  ])

  if (!question) notFound()

  // Pre-load chapters for the question's subject and units for its chapter
  const [chapters, units] = await Promise.all([
    prisma.chapter.findMany({
      where: { subjectId: question.subjectId, isActive: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    question.chapterId
      ? prisma.unit.findMany({
          where: { chapterId: question.chapterId },
          select: { id: true, name: true },
          orderBy: { sortOrder: "asc" },
        })
      : Promise.resolve([]),
  ])

  const initial = {
    subjectId: question.subjectId,
    chapterId: question.chapterId,
    unitId: question.unitId ?? "",
    topicId: question.topicId ?? "",
    year: question.year ?? null,
    stem: question.stem as ContentBlock[],
    options: question.options.map((o) => ({
      id: o.id,
      content: o.content as ContentBlock,
      isCorrect: o.isCorrect,
      rationale: o.rationale ?? "",
      sortOrder: o.sortOrder,
    })),
    explanation: (question.explanation ?? []) as ContentBlock[],
    difficulty: question.difficulty,
    allowMultipleCorrect: question.allowMultipleCorrect,
    tags: (question.tags as string[]) ?? [],
    sourceNote: question.sourceNote ?? "",
    aiAssisted: question.aiAssisted,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Edit question</h1>
        <p className="mt-0.5 font-mono text-xs text-slate-400">{id}</p>
      </div>
      <QuestionEditor
        mode="edit"
        questionId={id}
        initial={initial}
        subjects={subjects}
        initialChapters={chapters}
        initialUnits={units}
      />
    </div>
  )
}
