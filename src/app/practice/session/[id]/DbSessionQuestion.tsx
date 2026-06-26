"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { DemoQuestion } from "@/lib/questions/demo-data"
import type { Accent } from "@/lib/accents"
import { QuestionCard } from "@/components/questions/question-card"
import { SwissQuestionCard } from "@/components/questions/swiss-question-card"
import { XpToast } from "@/components/ui/xp-toast"
import { BadgeModal } from "@/components/ui/badge-modal"
import { ReportModal } from "@/components/ui/report-modal"
import { UpgradeModal } from "@/components/ui/upgrade-modal"
import { impactHeavy } from "@/lib/native/haptics"
import { useOnlineStatus } from "@/lib/native/network"
import { ExamTimer } from "./ExamTimer"

type Props = {
  question: DemoQuestion
  currentIndex: number
  total: number
  nextHref: string
  wrongHref: string
  sessionId: string
  questionId: string
  style: "duo" | "swiss"
  accent: Accent
  examExpiresAt?: string
}

export function DbSessionQuestion({
  question,
  currentIndex,
  total,
  nextHref,
  wrongHref,
  sessionId,
  questionId,
  style,
  accent,
  examExpiresAt,
}: Props) {
  const router = useRouter()
  const storageKey = `mcq:db:${sessionId}:${questionId}`
  const online = useOnlineStatus()

  const [xpToast, setXpToast] = useState<number | null>(null)
  const [badgeQueue, setBadgeQueue] = useState<string[]>([])
  const [answered, setAnswered] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem(storageKey)
    if (stored) router.replace(stored)
  }, [storageKey, router])

  async function handleAnswered(isRight: boolean, confidence?: "high" | "medium" | "low") {
    setAnswered(true)
    const target = isRight ? nextHref : wrongHref
    sessionStorage.setItem(storageKey, target)

    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          questionId,
          isCorrect: isRight,
          confidence,
          mode: "PRACTICE",
        }),
      })
      if (res.status === 429) {
        setShowUpgrade(true)
        return
      }
      if (res.ok) {
        const data = await res.json() as {
          xpAwarded?: number
          newBadges?: string[]
          streakCurrent?: number
        }
        if (data.xpAwarded) setXpToast(data.xpAwarded)
        if (data.newBadges?.length) setBadgeQueue(data.newBadges)
        if (data.streakCurrent === 7 || data.streakCurrent === 30) impactHeavy()
      }
    } catch {
      // Offline — navigate anyway; XP will be missing but UX isn't blocked
    }
  }

  const Component = style === "swiss" ? SwissQuestionCard : QuestionCard

  return (
    <>
      {examExpiresAt && (
        <div className="fixed right-4 top-4 z-50">
          <ExamTimer expiresAt={examExpiresAt} sessionId={sessionId} />
        </div>
      )}
      {!online && (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-semibold text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
          </svg>
          No internet — answers will not be saved
        </div>
      )}
      <Component
        question={question}
        currentIndex={currentIndex}
        total={total}
        nextHref={nextHref}
        wrongHref={wrongHref}
        onAnswered={handleAnswered}
        accent={accent}
      />

      {xpToast !== null && (
        <XpToast amount={xpToast} onDone={() => setXpToast(null)} />
      )}

      {badgeQueue[0] && (
        <BadgeModal
          badgeKey={badgeQueue[0]}
          onClose={() => setBadgeQueue((q) => q.slice(1))}
        />
      )}

      {answered && !showReport && (
        <button
          type="button"
          onClick={() => setShowReport(true)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-400 shadow-sm transition hover:border-slate-300 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:text-slate-300"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Report issue
        </button>
      )}

      {showReport && (
        <ReportModal questionId={questionId} onClose={() => setShowReport(false)} />
      )}

      {showUpgrade && (
        <UpgradeModal onClose={() => setShowUpgrade(false)} />
      )}
    </>
  )
}
