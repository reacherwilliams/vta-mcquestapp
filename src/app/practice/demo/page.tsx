import { QuestionCard } from "@/components/questions/question-card"
import { SwissQuestionCard } from "@/components/questions/swiss-question-card"
import { demoQuestions, getDemoQuestion } from "@/lib/questions/demo-data"
import { resolveAccent } from "@/lib/accents"
import { shuffleOptions } from "@/lib/questions/shuffle"

export const metadata = {
  title: "Try a demo question",
}

type SearchParams = Promise<{ q?: string; style?: string; accent?: string; pass?: string }>

function resolveStyle(raw: string | undefined) {
  return raw === "swiss" ? "swiss" : "duo"
}

const COMPONENTS = {
  duo: QuestionCard,
  swiss: SwissQuestionCard,
} as const

export default async function PracticeDemoPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { q, style, accent, pass: passParam } = await searchParams
  const index = Math.max(0, Math.min(Number(q ?? 0) || 0, demoQuestions.length - 1))
  const question = getDemoQuestion(index)
  const styleKey = resolveStyle(style)
  const accentKey = resolveAccent(accent)
  const Component = COMPONENTS[styleKey]

  // pass=0 → first time through (no shuffle)
  // pass=1,2,… → subsequent passes (different shuffle each pass)
  const pass = Math.max(0, Number(passParam ?? 0) || 0)

  // When continuing from the last question, wrap to Q0 and bump pass
  const nextIndex = (index + 1) % demoQuestions.length
  const nextPass = index === demoQuestions.length - 1 ? pass + 1 : pass
  const nextHref = `/practice/demo?q=${nextIndex}&style=${styleKey}&accent=${accentKey}&pass=${nextPass}`

  // Shuffle options on every pass after the first.
  // Image/graph option sets are never shuffled — visual layout is part of the question.
  const isImageOptions = question.options.every(
    (o) => o.content.kind === "image" || o.content.kind === "graph",
  )
  const shuffledQuestion =
    pass > 0
      ? {
          ...question,
          options: shuffleOptions(
            question.options,
            `demo:${question.id}:${pass}`,
            isImageOptions,
          ),
        }
      : question

  return (
    <Component
      key={`${styleKey}-${accentKey}-${question.id}-${pass}`}
      question={shuffledQuestion}
      currentIndex={index}
      total={demoQuestions.length}
      nextHref={nextHref}
      accent={accentKey}
    />
  )
}
