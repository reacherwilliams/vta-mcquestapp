import { demoQuestions, getDemoQuestion } from "@/lib/questions/demo-data"
import { resolveAccent } from "@/lib/accents"
import { shuffleOptions } from "@/lib/questions/shuffle"
import { SessionQuestion } from "./SessionQuestion"

export const metadata = { title: "Practice" }

type SearchParams = Promise<{
  qids?: string
  q?: string
  wrong?: string
  pass?: string
  run?: string
  style?: string
  accent?: string
}>

function resolveStyle(raw: string | undefined): "duo" | "swiss" {
  return raw === "swiss" ? "swiss" : "duo"
}

export default async function PracticeSessionPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { qids: qidsParam, q: qParam, wrong: wrongParam, pass: passParam, run: runParam, style, accent } =
    await searchParams

  // Parse question indices. Default: all demo questions (0..n-1).
  const allIndices = Array.from({ length: demoQuestions.length }, (_, i) => i)
  const qids = qidsParam
    ? qidsParam
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n) && n >= 0 && n < demoQuestions.length)
    : allIndices
  if (!qids.length) qids.push(...allIndices)

  const q = Math.max(0, Math.min(Number(qParam ?? 0) || 0, qids.length - 1))
  const wrongIds: string[] = wrongParam ? wrongParam.split(",").filter(Boolean) : []
  const pass = Math.max(0, Number(passParam ?? 0) || 0)
  const run = runParam ?? "direct"
  const styleKey = resolveStyle(style)
  const accentKey = resolveAccent(accent)

  const questionIndex = qids[q]
  const question = getDemoQuestion(questionIndex)

  // Shuffle options on retry passes (pass > 0)
  const isImageOptions = question.options.every(
    (o) => o.content.kind === "image" || o.content.kind === "graph",
  )
  const displayQuestion =
    pass > 0
      ? {
          ...question,
          options: shuffleOptions(
            question.options,
            `session:${question.id}:${pass}`,
            isImageOptions,
          ),
        }
      : question

  const isLastQuestion = q === qids.length - 1
  const sharedParams = `pass=${pass}&run=${run}&style=${styleKey}&accent=${accentKey}`
  const thisQid = String(questionIndex)

  let nextHref: string
  let wrongHref: string

  if (!isLastQuestion) {
    // Mid-session: advance to the next question
    const base = `/practice/session?qids=${qids.join(",")}&q=${q + 1}&${sharedParams}`
    nextHref = `${base}&wrong=${wrongIds.join(",")}`
    wrongHref = `${base}&wrong=${[...wrongIds, thisQid].join(",")}`
  } else {
    // Last question in this pass
    const retryBase = `/practice/session/retry?${sharedParams}`
    const completeBase = `/practice/session/complete?${sharedParams}`

    // If right: retry accumulated wrongs (if any), otherwise celebrate
    const accumulated = wrongIds.filter(Boolean)
    nextHref = accumulated.length > 0
      ? `${retryBase}&qids=${accumulated.join(",")}`
      : completeBase

    // If wrong: always retry (accumulated + this question)
    const allWrong = [...wrongIds, thisQid].filter(Boolean)
    wrongHref = `${retryBase}&qids=${allWrong.join(",")}`
  }

  return (
    // key forces a full remount on every question change so React doesn't
    // carry over submitted/selectedIds state from the previous question.
    <SessionQuestion
      key={`${run}-${question.id}-${pass}`}
      question={displayQuestion}
      currentIndex={q}
      total={qids.length}
      nextHref={nextHref}
      wrongHref={wrongHref}
      questionId={question.id}
      run={run}
      pass={pass}
      style={styleKey}
      accent={accentKey}
    />
  )
}
