import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

function isAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

// ─── Import schema ────────────────────────────────────────────────────────────

const optionSchema = z.object({
  content: z.union([
    z.object({ kind: z.literal("text"), text: z.string().min(1) }),
    z.object({ kind: z.literal("math"), latex: z.string().min(1), display: z.boolean().default(false) }),
  ]),
  isCorrect: z.boolean(),
  rationale: z.string().optional(),
  sortOrder: z.number().int().min(0),
})

const blockSchema = z.union([
  z.object({ kind: z.literal("text"), text: z.string().min(1) }),
  z.object({ kind: z.literal("math"), latex: z.string().min(1), display: z.boolean().default(false) }),
])

const questionImportSchema = z.object({
  subjectCode: z.string(),
  chapterName: z.string(),
  stem: z.array(blockSchema).min(1),
  options: z.array(optionSchema).min(2).max(6),
  explanation: z.array(blockSchema).optional().default([]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD", "CHALLENGE"]).default("MEDIUM"),
  allowMultipleCorrect: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  sourceNote: z.string().optional(),
  aiAssisted: z.boolean().default(false),
})

const importBodySchema = z.object({
  curriculumCode: z.string(),
  questions: z.array(questionImportSchema).min(1).max(200),
})

type ImportQuestion = z.infer<typeof questionImportSchema>

export async function POST(req: Request) {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const raw = await req.json()
  const parsed = importBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { curriculumCode, questions } = parsed.data

  // Resolve curriculum
  const curriculum = await prisma.curriculum.findFirst({ where: { code: curriculumCode } })
  if (!curriculum) {
    return NextResponse.json({ error: `Curriculum '${curriculumCode}' not found.` }, { status: 400 })
  }

  // Resolve subjects and chapters in batch
  const subjects = await prisma.subject.findMany({
    where: { curriculumId: curriculum.id },
    select: { id: true, code: true },
  })
  const subjectByCode = Object.fromEntries(subjects.map((s) => [s.code.toUpperCase(), s.id]))

  // Collect unique chapter lookups
  const uniqueChapters = [...new Set(
    questions.map((q) => `${subjectByCode[q.subjectCode.toUpperCase()] ?? ""}::${q.chapterName}`)
  )].filter((k) => k.startsWith(":") === false)

  const chapterRecords = await prisma.chapter.findMany({
    where: {
      OR: uniqueChapters.map((k) => {
        const [subjectId, name] = k.split("::")
        return { subjectId, name }
      }),
    },
    select: { id: true, subjectId: true, name: true },
  })
  const chapterKey = (subjectId: string, name: string) => `${subjectId}::${name}`
  const chapterByKey = Object.fromEntries(
    chapterRecords.map((c) => [chapterKey(c.subjectId, c.name), c.id])
  )

  const results: { index: number; id?: string; error?: string }[] = []

  for (let i = 0; i < questions.length; i++) {
    const q: ImportQuestion = questions[i]
    const subjectId = subjectByCode[q.subjectCode.toUpperCase()]
    if (!subjectId) { results.push({ index: i, error: `Subject '${q.subjectCode}' not found` }); continue }

    const chapterId = chapterByKey[chapterKey(subjectId, q.chapterName)]
    if (!chapterId) { results.push({ index: i, error: `Chapter '${q.chapterName}' not found in subject '${q.subjectCode}'` }); continue }

    if (!q.options.some((o) => o.isCorrect)) {
      results.push({ index: i, error: "No correct option marked" })
      continue
    }

    try {
      const created = await prisma.question.create({
        data: {
          subjectId,
          chapterId,
          stem: q.stem,
          explanation: q.explanation ?? [],
          difficulty: q.difficulty,
          allowMultipleCorrect: q.allowMultipleCorrect,
          tags: q.tags,
          sourceNote: q.sourceNote ?? null,
          aiAssisted: q.aiAssisted,
          status: "DRAFT",
          authorId: session!.user!.id,
          options: {
            create: q.options.map((o) => ({
              content: o.content,
              isCorrect: o.isCorrect,
              rationale: o.rationale ?? null,
              sortOrder: o.sortOrder,
            })),
          },
        },
        select: { id: true },
      })
      results.push({ index: i, id: created.id })
    } catch {
      results.push({ index: i, error: "DB error creating question" })
    }
  }

  const created = results.filter((r) => r.id)
  const failed  = results.filter((r) => r.error)

  return NextResponse.json({ created: created.length, failed: failed.length, results })
}
