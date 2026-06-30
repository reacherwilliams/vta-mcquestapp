import { prisma } from "@/lib/prisma"
import { QuestionEditor } from "../QuestionEditor"

export const metadata = { title: "Admin — New Question" }

export default async function NewQuestionPage() {
  const subjects = await prisma.subject.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, code: true, syllabusCode: true, curriculumId: true,
      curriculum: { select: { code: true, displayName: true } },
    },
    orderBy: [{ curriculum: { sortOrder: "asc" } }, { name: "asc" }],
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">New question</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Write exam-style originals only — never verbatim past-paper text.
        </p>
      </div>
      <QuestionEditor mode="new" subjects={subjects} />
    </div>
  )
}
