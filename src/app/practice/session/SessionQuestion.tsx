"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import type { DemoQuestion } from "@/lib/questions/demo-data"
import type { Accent } from "@/lib/accents"
import { QuestionCard } from "@/components/questions/question-card"
import { SwissQuestionCard } from "@/components/questions/swiss-question-card"

type Props = {
  question: DemoQuestion
  currentIndex: number
  total: number
  nextHref: string
  wrongHref: string
  questionId: string
  run: string
  pass: number
  style: "duo" | "swiss"
  accent: Accent
}

export function SessionQuestion({
  question,
  currentIndex,
  total,
  nextHref,
  wrongHref,
  questionId,
  run,
  pass,
  style,
  accent,
}: Props) {
  const router = useRouter()
  // run scopes storage to a single session start so stale answers from a
  // previous session can't auto-advance the current one.
  const storageKey = `mcq:ans:${run}:${questionId}:${pass}`

  // On mount: if this question was already answered (e.g. refresh mid-question),
  // skip straight to where we would have gone.
  useEffect(() => {
    const stored = sessionStorage.getItem(storageKey)
    if (stored) router.replace(stored)
  }, [storageKey, router])

  function handleAnswered(isRight: boolean) {
    const target = isRight ? nextHref : wrongHref
    sessionStorage.setItem(storageKey, target)
  }

  const Component = style === "swiss" ? SwissQuestionCard : QuestionCard

  return (
    <Component
      question={question}
      currentIndex={currentIndex}
      total={total}
      nextHref={nextHref}
      wrongHref={wrongHref}
      onAnswered={handleAnswered}
      accent={accent}
    />
  )
}
