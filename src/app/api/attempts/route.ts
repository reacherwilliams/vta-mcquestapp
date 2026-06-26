import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calcXp } from "@/lib/xp"

// ── Badge catalogue (upserted on first use, no separate seed step needed) ──────
const BADGE_DEFS = [
  { key: "first_correct",      name: "First blood",    description: "Answer your first question correctly.",                   iconKey: "check-circle", rarity: "common"    },
  { key: "streak_7",           name: "On a roll",       description: "Reach a 7-day streak.",                                   iconKey: "flame",        rarity: "rare"      },
  { key: "streak_30",          name: "Unstoppable",     description: "Reach a 30-day streak.",                                  iconKey: "zap",          rarity: "epic"      },
  { key: "first_retry",        name: "Face your fears", description: "Complete your first Revision Deck session.",              iconKey: "refresh-cw",   rarity: "common"    },
  { key: "perfect_session",    name: "Flawless",        description: "Complete a 10+ question session with no misses.",         iconKey: "star",         rarity: "rare"      },
  { key: "speed_demon",        name: "Speed demon",     description: "Answer 5 questions in a row in under 15 s each.",         iconKey: "timer",        rarity: "epic"      },
  { key: "revision_deck_clear",name: "Clean slate",     description: "Clear every wrong answer in your Revision Deck.",         iconKey: "check-square", rarity: "rare"      },
  { key: "boss_win",           name: "Boss slayer",     description: "Complete a chapter Boss fight without a single mistake.",   iconKey: "zap",          rarity: "legendary"  },
] as const

type BadgeKey = (typeof BADGE_DEFS)[number]["key"]

async function awardBadgeIfNew(userId: string, key: BadgeKey): Promise<boolean> {
  const def = BADGE_DEFS.find((b) => b.key === key)!
  const badge = await prisma.badge.upsert({
    where: { key },
    create: def,
    update: {},
    select: { id: true },
  })
  try {
    await prisma.badgeAward.create({ data: { userId, badgeId: badge.id } })
    return true
  } catch {
    return false // unique constraint — already awarded
  }
}

// For dynamically-keyed badges (subject mastery) not in BADGE_DEFS
async function awardDynamicBadgeIfNew(
  userId: string,
  key: string,
  def: { name: string; description: string; iconKey: string; rarity: string },
): Promise<boolean> {
  const badge = await prisma.badge.upsert({
    where: { key },
    create: { key, ...def },
    update: {},
    select: { id: true },
  })
  try {
    await prisma.badgeAward.create({ data: { userId, badgeId: badge.id } })
    return true
  } catch {
    return false
  }
}

// ── Streak helper ─────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function isYesterday(candidate: Date, today: Date): boolean {
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  return isSameDay(candidate, yesterday)
}

async function updateStreak(userId: string): Promise<number> {
  const today = new Date()
  const streak = await prisma.streak.findUnique({ where: { userId } })

  if (!streak) {
    await prisma.streak.create({
      data: { userId, current: 1, longest: 1, lastActiveDate: today },
    })
    return 1
  }

  // Already counted today
  if (streak.lastActiveDate && isSameDay(streak.lastActiveDate, today)) {
    return streak.current
  }

  const newCurrent = streak.lastActiveDate && isYesterday(streak.lastActiveDate, today)
    ? streak.current + 1
    : 1 // gap — reset (cron handles freeze logic nightly)

  const newLongest = Math.max(streak.longest, newCurrent)
  await prisma.streak.update({
    where: { userId },
    data: { current: newCurrent, longest: newLongest, lastActiveDate: today },
  })
  return newCurrent
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  const userId = session.user.id

  let body: {
    sessionId?: string
    questionId?: string
    selectedOptionId?: string | null
    isCorrect?: boolean
    timeSeconds?: number
    mode?: string
    confidence?: "high" | "medium" | "low"
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  const { sessionId, questionId, selectedOptionId, isCorrect, timeSeconds, mode, confidence } = body

  if (!questionId || isCorrect === undefined) {
    return NextResponse.json({ error: "questionId and isCorrect are required." }, { status: 400 })
  }

  // ── Free-tier gate (10 attempts per UTC day) ──────────────────────────────
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true },
  })
  const plan = sub?.plan ?? "FREE"
  if (plan === "FREE") {
    const dayStart = new Date()
    dayStart.setUTCHours(0, 0, 0, 0)
    const todayCount = await prisma.attempt.count({
      where: { userId, createdAt: { gte: dayStart } },
    })
    if (todayCount >= 10) {
      return NextResponse.json(
        { error: "daily_limit", message: "You've reached your 10 free questions for today. Upgrade to Pro for unlimited access.", upgradeUrl: "/pricing" },
        { status: 429 }
      )
    }
  }

  try {
    const [question, ps] = await Promise.all([
      prisma.question.findUniqueOrThrow({
        where: { id: questionId },
        select: { subjectId: true, chapterId: true, difficulty: true },
      }),
      sessionId
        ? prisma.practiceSession.findUnique({
            where: { id: sessionId },
            select: { questionIds: true, currentIndex: true, mode: true },
          })
        : Promise.resolve(null),
    ])

    // ── Streak update (do first — needed for XP bonus) ──────────────────
    const streakCurrent = await updateStreak(userId)

    // ── XP calculation ──────────────────────────────────────────────────
    const { amount: baseXp, reason: xpReason } = calcXp(
      isCorrect ?? false,
      question.difficulty,
      streakCurrent,
    )
    // Confidence modifier: Right+High=+4, Wrong+High=−2, Low=flat
    let confidenceBonus = 0
    if (confidence === "high") confidenceBonus = (isCorrect ?? false) ? 4 : -2
    const xpAwarded = Math.max(0, baseXp + confidenceBonus)

    // ── Record attempt ──────────────────────────────────────────────────
    const attempt = await prisma.attempt.create({
      data: {
        userId,
        questionId,
        sessionId: sessionId ?? null,
        selectedOptionId: selectedOptionId ?? null,
        isCorrect: isCorrect ?? false,
        timeSeconds: timeSeconds ?? 0,
        mode: (mode as "PRACTICE" | "WRONG_RETRY" | "EXAM" | "BOSS") ??
              (ps?.mode ?? "PRACTICE"),
        xpAwarded,
        confidence: confidence ?? null,
      },
    })

    // ── XP ledger ───────────────────────────────────────────────────────
    await prisma.xpLedger.create({
      data: { userId, delta: xpAwarded, reason: xpReason, attemptId: attempt.id },
    })

    // ── Revision Deck (WrongAnswer queue) ───────────────────────────────
    if (!isCorrect) {
      await prisma.wrongAnswer.upsert({
        where: { userId_questionId: { userId, questionId } },
        create: { userId, questionId },
        update: { retryCount: { increment: 1 }, resolvedAt: null },
      })
    } else {
      await prisma.wrongAnswer.updateMany({
        where: { userId, questionId, resolvedAt: null },
        data: { resolvedAt: new Date() },
      })
    }

    // ── Subject progress ────────────────────────────────────────────────
    await prisma.subjectProgress.upsert({
      where: { userId_subjectId: { userId, subjectId: question.subjectId } },
      create: {
        userId,
        subjectId: question.subjectId,
        attempted: 1,
        correct: isCorrect ? 1 : 0,
        masteryPercent: isCorrect ? 100 : 0,
        lastPracticedAt: new Date(),
      },
      update: {
        attempted: { increment: 1 },
        correct: isCorrect ? { increment: 1 } : undefined,
        lastPracticedAt: new Date(),
      },
    })

    const sp = await prisma.subjectProgress.findUniqueOrThrow({
      where: { userId_subjectId: { userId, subjectId: question.subjectId } },
      select: { attempted: true, correct: true },
    })
    await prisma.subjectProgress.update({
      where: { userId_subjectId: { userId, subjectId: question.subjectId } },
      data: { masteryPercent: sp.attempted > 0 ? (sp.correct / sp.attempted) * 100 : 0 },
    })

    // ── League weekly XP increment ──────────────────────────────────────
    if (xpAwarded > 0) {
      await prisma.leagueMembership.updateMany({
        where: {
          userId,
          league: { endsAt: { gt: new Date() } },
        },
        data: { weeklyXp: { increment: xpAwarded } },
      })
    }

    // ── Session advancement + completion ────────────────────────────────
    let sessionComplete = false
    if (sessionId && ps) {
      const total = (ps.questionIds as string[]).length
      const newIndex = ps.currentIndex + 1
      sessionComplete = newIndex >= total
      await prisma.practiceSession.update({
        where: { id: sessionId },
        data: {
          currentIndex: newIndex,
          ...(sessionComplete ? { status: "COMPLETED", completedAt: new Date() } : {}),
        },
      })
    }

    // ── Badge checks ────────────────────────────────────────────────────
    const newBadges: string[] = []

    if (isCorrect) {
      // first_correct: very first correct answer
      const totalCorrect = await prisma.attempt.count({ where: { userId, isCorrect: true } })
      if (totalCorrect === 1) {
        const awarded = await awardBadgeIfNew(userId, "first_correct")
        if (awarded) newBadges.push("first_correct")
      }

      // streak_7 / streak_30
      if (streakCurrent === 7) {
        const awarded = await awardBadgeIfNew(userId, "streak_7")
        if (awarded) newBadges.push("streak_7")
      }
      if (streakCurrent === 30) {
        const awarded = await awardBadgeIfNew(userId, "streak_30")
        if (awarded) newBadges.push("streak_30")
      }

      // perfect_session: completed session ≥ 10 questions, 0 wrong in this session
      if (sessionComplete && ps) {
        const total = (ps.questionIds as string[]).length
        if (total >= 10) {
          const wrongInSession = await prisma.attempt.count({
            where: { sessionId, isCorrect: false },
          })
          if (wrongInSession === 0) {
            const awarded = await awardBadgeIfNew(userId, "perfect_session")
            if (awarded) newBadges.push("perfect_session")
          }
        }
      }

      // first_retry: first WRONG_RETRY session completed
      if (sessionComplete && ps?.mode === "WRONG_RETRY") {
        const awarded = await awardBadgeIfNew(userId, "first_retry")
        if (awarded) newBadges.push("first_retry")
      }

      // revision_deck_clear: no unresolved wrong answers remain at all
      const unresolvedCount = await prisma.wrongAnswer.count({
        where: { userId, resolvedAt: null },
      })
      if (unresolvedCount === 0) {
        const totalAttempts = await prisma.attempt.count({ where: { userId } })
        if (totalAttempts >= 10) { // avoid awarding on first ever question
          const awarded = await awardBadgeIfNew(userId, "revision_deck_clear")
          if (awarded) newBadges.push("revision_deck_clear")
        }
      }

      // boss_win: perfect BOSS session
      if (sessionComplete && ps?.mode === "BOSS") {
        const wrongInBoss = await prisma.attempt.count({ where: { sessionId, isCorrect: false } })
        if (wrongInBoss === 0) {
          // +50 XP bonus
          await prisma.xpLedger.create({
            data: { userId, delta: 50, reason: "boss_win_bonus", attemptId: attempt.id },
          })
          const awarded = await awardBadgeIfNew(userId, "boss_win")
          if (awarded) newBadges.push("boss_win")
        }
      }

      // subject_mastered_*: ≥80% mastery on ≥50 attempts in a subject
      const freshSp = await prisma.subjectProgress.findUnique({
        where: { userId_subjectId: { userId, subjectId: question.subjectId } },
        select: { attempted: true, masteryPercent: true },
      })
      if (freshSp && freshSp.attempted >= 50 && freshSp.masteryPercent >= 80) {
        const subject = await prisma.subject.findUnique({
          where: { id: question.subjectId },
          select: { name: true },
        })
        if (subject) {
          const badgeKey = `subject_mastered_${question.subjectId}`
          const awarded = await awardDynamicBadgeIfNew(userId, badgeKey, {
            name: `${subject.name} Master`,
            description: `Reach 80% mastery across 50+ ${subject.name} questions.`,
            iconKey: "award",
            rarity: "epic",
          })
          if (awarded) newBadges.push(badgeKey)
        }
      }
    }

    return NextResponse.json({
      attemptId: attempt.id,
      xpAwarded,
      streakCurrent,
      sessionComplete,
      newBadges,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
