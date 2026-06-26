import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getSessionQuestion } from "@/lib/sessions/practice"
import { resolveAccent } from "@/lib/accents"
import type { DemoQuestion, DemoOption } from "@/lib/questions/demo-data"
import type { ContentBlock, QuestionStem, Explanation } from "@/lib/questions/types"
import { DbSessionQuestion } from "./DbSessionQuestion"

export const metadata = { title: "Practice" }

type SearchParams = Promise<{
  q?: string
  wrong?: string
  style?: string
  accent?: string
  exam?: string
}>

function resolveStyle(raw: string | undefined): "duo" | "swiss" {
  return raw === "swiss" ? "swiss" : "duo"
}

type SessionResult = NonNullable<Awaited<ReturnType<typeof getSessionQuestion>>>

/** Convert a Prisma question row to the DemoQuestion shape the renderer expects. */
function toDisplayQuestion(q: SessionResult["question"]): DemoQuestion {
  return {
    id: q.id,
    curriculum: q.subject.curriculum.code,
    subject: q.subject.name,
    chapter: q.chapter.name,
    difficulty: q.difficulty as DemoQuestion["difficulty"],
    tags: q.tags as string[],
    stem: q.stem as QuestionStem,
    explanation: (q.explanation ?? []) as Explanation,
    allowMultipleCorrect: q.allowMultipleCorrect,
    options: q.options.map((o: SessionResult["question"]["options"][number]) => ({
      id: o.id,
      content: o.content as ContentBlock,
      isCorrect: o.isCorrect,
      rationale: o.rationale ?? undefined,
    })) as DemoOption[],
  }
}

export default async function DbSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const { id: sessionId } = await params
  const { q: qParam, wrong: wrongParam, style, accent: accentParam, exam } = await searchParams

  const styleKey = resolveStyle(style)
  const accentKey = resolveAccent(accentParam)

  let result: Awaited<ReturnType<typeof getSessionQuestion>>
  try {
    const q = Math.max(0, Number(qParam ?? 0) || 0)
    const data = await getSessionQuestion(sessionId, q)
    if (!data) notFound()
    result = data
  } catch {
    notFound()
  }

  // Verify this session belongs to the current user
  if (result.session.userId !== session.user.id) {
    redirect("/practice")
  }

  const { session: ps, question, total } = result
  const questionIds = ps.questionIds as string[]
  const q = Math.max(0, Number(qParam ?? 0) || 0)
  const isExam = ps.mode === "EXAM"

  const wrongIds: string[] = wrongParam ? wrongParam.split(",").filter(Boolean) : []
  const isLastQuestion = q === total - 1
  const sharedExamParam = isExam ? "&exam=1" : ""
  const sharedParams = `style=${styleKey}&accent=${accentKey}`
  const base = `/practice/session/${sessionId}`

  let nextHref: string
  let wrongHref: string

  if (!isLastQuestion) {
    nextHref = `${base}?q=${q + 1}&wrong=${wrongIds.join(",")}&${sharedParams}${sharedExamParam}`
    wrongHref = `${base}?q=${q + 1}&wrong=${[...wrongIds, question.id].join(",")}&${sharedParams}${sharedExamParam}`
  } else if (isExam) {
    // Exam: always go to summary on last question
    nextHref = `/practice/session/${sessionId}/summary`
    wrongHref = nextHref
  } else {
    const completeBase = `/practice/session/complete?${sharedParams}`
    const accumulated = wrongIds.filter(Boolean)
    nextHref = accumulated.length > 0
      ? `/practice/session/${sessionId}/retry?count=${accumulated.length}&${sharedParams}`
      : completeBase
    const allWrong = [...wrongIds, question.id].filter(Boolean)
    wrongHref = `/practice/session/${sessionId}/retry?count=${allWrong.length}&${sharedParams}`
  }

  const displayQuestion = toDisplayQuestion(question)

  return (
    <DbSessionQuestion
      key={`${sessionId}:${question.id}`}
      question={displayQuestion}
      currentIndex={q}
      total={total}
      nextHref={nextHref}
      wrongHref={wrongHref}
      sessionId={sessionId}
      questionId={question.id}
      style={styleKey}
      accent={accentKey}
      examExpiresAt={isExam && ps.expiresAt ? ps.expiresAt.toISOString() : undefined}
    />
  )
}
