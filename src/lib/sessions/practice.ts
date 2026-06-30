import "server-only"
import { prisma } from "@/lib/prisma"
import { shuffledOptionIds } from "@/lib/questions/shuffle"
import { getEntitledSubjectScope, scopeAllows } from "@/lib/entitlements"

// ── Types ──────────────────────────────────────────────────────────────────

export type SessionFilter = {
  curriculumId?: string
  subjectId?: string
  chapterId?: string
  years?: string[]        // e.g. ["2023", "2024"]
  difficulty?: string[]   // e.g. ["EASY", "MEDIUM"]
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isImageOptions(contentList: { kind: string }[]): boolean {
  return contentList.every((c) => c.kind === "image" || c.kind === "graph")
}

// Seed: userId + questionId + retryCount gives a different shuffle each
// attempt while staying stable across refreshes within the same attempt.
function shuffleSeed(userId: string, questionId: string, retryCount: number): string {
  return `${userId}:${questionId}:${retryCount}`
}

// ── Session creation ───────────────────────────────────────────────────────

/**
 * Creates a standard PRACTICE session from a filter.
 * Options are shown in canonical DB order (no shuffle needed for first attempt).
 */
export async function createPracticeSession(
  userId: string,
  filter: SessionFilter,
  limit = 20,
  role?: string | null,
) {
  const scope = await getEntitledSubjectScope(userId, role)
  if (scope !== null && filter.subjectId && !scopeAllows(scope, filter.subjectId)) {
    throw new Error("You're not enrolled in this subject.")
  }

  const questions = await prisma.question.findMany({
    where: buildWhereClause(filter, scope),
    select: { id: true },
    take: limit,
    orderBy: { createdAt: "asc" },
  })

  if (!questions.length) throw new Error("No questions match the selected filter.")

  return prisma.practiceSession.create({
    data: {
      userId,
      mode: "PRACTICE",
      filter,
      questionIds: questions.map((q) => q.id),
      optionOrders: undefined, // canonical order — field left null in DB
    },
  })
}

/**
 * Creates a WRONG_RETRY session from the user's unresolved wrong answers.
 * Options are shuffled per-question with a seed derived from userId +
 * questionId + retryCount, so the order differs from every previous attempt
 * but remains stable if the student refreshes mid-question.
 */
export async function createWrongRetrySession(userId: string) {
  // Fetch unresolved wrong answers with their question's option metadata
  const wrongAnswers = await prisma.wrongAnswer.findMany({
    where: { userId, resolvedAt: null },
    include: {
      question: {
        include: {
          options: {
            select: { id: true, content: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
    orderBy: { firstWrongAt: "asc" },
  })

  if (!wrongAnswers.length) throw new Error("No wrong answers to retry.")

  // Build optionOrders map: { [questionId]: optionId[] }
  const optionOrders: Record<string, string[]> = {}

  for (const wa of wrongAnswers) {
    const q = wa.question
    const optionContents = q.options.map((o) => o.content as { kind: string })
    const imgOnly = isImageOptions(optionContents)
    const seed = shuffleSeed(userId, q.id, wa.retryCount + 1)
    optionOrders[q.id] = shuffledOptionIds(
      q.options.map((o) => o.id),
      seed,
      imgOnly,
    )
  }

  return prisma.practiceSession.create({
    data: {
      userId,
      mode: "WRONG_RETRY",
      filter: {},
      questionIds: wrongAnswers.map((wa) => wa.question.id),
      optionOrders,
    },
  })
}

/**
 * Fetches the next question in a session with options in the correct
 * (possibly shuffled) order for that session.
 */
export async function getSessionQuestion(sessionId: string, index: number) {
  const session = await prisma.practiceSession.findUniqueOrThrow({
    where: { id: sessionId },
  })

  const questionIds = session.questionIds as string[]
  const questionId = questionIds[index]
  if (!questionId) return null

  const question = await prisma.question.findUniqueOrThrow({
    where: { id: questionId },
    include: {
      subject: { include: { curriculum: true } },
      chapter: true,
      options: { orderBy: { sortOrder: "asc" } },
    },
  })

  // Re-order options if this session has a stored shuffle for this question
  const optionOrders = (session.optionOrders ?? {}) as Record<string, string[]>
  const orderedIds = optionOrders[questionId]

  if (orderedIds) {
    const map = new Map(question.options.map((o) => [o.id, o]))
    question.options = orderedIds
      .map((id) => map.get(id))
      .filter((o): o is (typeof question.options)[number] => o !== undefined)
  }

  return { session, question, total: questionIds.length }
}

// ── Exam presets ──────────────────────────────────────────────────────────

export type ExamPreset = {
  id: string
  label: string
  description: string
  subjectName: string
  curriculumCode: string
  durationMinutes: number
  questionCount: number
}

export const EXAM_PRESETS: ExamPreset[] = [
  { id: "igcse-physics-p1",   label: "IGCSE Physics Paper 1",    description: "45 min · 40 MCQs",  subjectName: "Physics",     curriculumCode: "IGCSE",   durationMinutes: 45, questionCount: 40 },
  { id: "igcse-chemistry-p1", label: "IGCSE Chemistry Paper 1",  description: "45 min · 40 MCQs",  subjectName: "Chemistry",   curriculumCode: "IGCSE",   durationMinutes: 45, questionCount: 40 },
  { id: "igcse-biology-p1",   label: "IGCSE Biology Paper 1",    description: "45 min · 40 MCQs",  subjectName: "Biology",     curriculumCode: "IGCSE",   durationMinutes: 45, questionCount: 40 },
  { id: "igcse-math-p1",      label: "IGCSE Mathematics Paper 1",description: "45 min · 40 MCQs",  subjectName: "Mathematics", curriculumCode: "IGCSE",   durationMinutes: 45, questionCount: 40 },
  { id: "al-physics-p1",      label: "A-Level Physics Paper 1",  description: "60 min · 40 MCQs",  subjectName: "Physics",     curriculumCode: "A_LEVEL", durationMinutes: 60, questionCount: 40 },
  { id: "al-chemistry-p1",    label: "A-Level Chemistry Paper 1",description: "60 min · 40 MCQs",  subjectName: "Chemistry",   curriculumCode: "A_LEVEL", durationMinutes: 60, questionCount: 40 },
  { id: "al-biology-p1",      label: "A-Level Biology Paper 1",  description: "60 min · 40 MCQs",  subjectName: "Biology",     curriculumCode: "A_LEVEL", durationMinutes: 60, questionCount: 40 },
  { id: "custom",             label: "Custom",                   description: "Set your own time", subjectName: "",            curriculumCode: "",        durationMinutes: 30, questionCount: 20 },
]

/**
 * Creates an EXAM session with a server-anchored expiry time.
 */
export async function createExamSession(
  userId: string,
  filter: SessionFilter,
  durationMinutes: number,
  questionCount: number,
  role?: string | null,
) {
  const scope = await getEntitledSubjectScope(userId, role)
  if (scope !== null && filter.subjectId && !scopeAllows(scope, filter.subjectId)) {
    throw new Error("You're not enrolled in this subject.")
  }

  const questions = await prisma.question.findMany({
    where: buildWhereClause(filter, scope),
    select: { id: true },
    take: questionCount,
    orderBy: { createdAt: "asc" },
  })

  if (!questions.length) throw new Error("No questions match the selected filter.")

  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000)

  return prisma.practiceSession.create({
    data: {
      userId,
      mode: "EXAM",
      filter,
      questionIds: questions.map((q) => q.id),
      expiresAt,
    },
  })
}

// ── Filter builder ────────────────────────────────────────────────────────

function buildWhereClause(filter: SessionFilter, scope: string[] | null = null) {
  // Subject scoping: an explicit (already entitlement-checked) subjectId wins;
  // otherwise restrict to the entitled subjects when a scope is enforced.
  const subjectClause = filter.subjectId
    ? { subjectId: filter.subjectId }
    : scope !== null
      ? { subjectId: { in: scope } }
      : {}
  return {
    status: "PUBLISHED" as const,
    ...(filter.curriculumId && {
      subject: { curriculumId: filter.curriculumId },
    }),
    ...subjectClause,
    ...(filter.chapterId && { chapterId: filter.chapterId }),
    ...(filter.difficulty?.length && {
      difficulty: { in: filter.difficulty as ("EASY" | "MEDIUM" | "HARD" | "CHALLENGE")[] },
    }),
    ...(filter.years?.length && {
      // tags is a JSON array — filter questions that contain at least one of the requested years
      AND: filter.years.map((y) => ({
        tags: { array_contains: y },
      })),
    }),
  }
}
