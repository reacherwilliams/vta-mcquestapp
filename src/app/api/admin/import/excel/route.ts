import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { QuestionDifficulty } from "@prisma/client"
import ExcelJS from "exceljs"

function isAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function bool(v: unknown): boolean {
  const s = str(v).toUpperCase()
  return s === "TRUE" || s === "1" || s === "YES"
}

type ContentBlock =
  | { kind: "text"; text: string }
  | { kind: "math"; latex: string; display: boolean }

function buildBlocks(text: string, latex: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  if (text) blocks.push({ kind: "text", text })
  if (latex) blocks.push({ kind: "math", latex, display: true })
  return blocks
}

export async function POST(req: Request) {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  // ── Parse multipart form ──────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file uploaded." }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = Buffer.from(await file.arrayBuffer()) as any
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buffer)
  } catch {
    return NextResponse.json({ error: "Could not read .xlsx file. Make sure it is a valid Excel workbook." }, { status: 400 })
  }

  const sheet = wb.getWorksheet("Questions")
  if (!sheet) {
    return NextResponse.json({ error: 'Workbook must contain a sheet named "Questions".' }, { status: 400 })
  }

  // ── Read header row to map column indices ─────────────────────────────────
  const headerRow = sheet.getRow(1)
  const colIndex: Record<string, number> = {}
  headerRow.eachCell((cell, col) => {
    // Strip the " *" and extra notes from header names
    const key = str(cell.value).replace(/\s*\*.*$/, "").replace(/\s*\(.*\)/, "").trim().toLowerCase().replace(/[\s-]+/g, "_")
    colIndex[key] = col
  })

  function cell(row: ExcelJS.Row, name: string): string {
    const col = colIndex[name]
    if (!col) return ""
    const v = row.getCell(col).value
    if (v instanceof Date) return v.getFullYear().toString()
    return str(v)
  }

  // ── Collect rows ──────────────────────────────────────────────────────────
  type RawRow = {
    rowNum: number
    curriculumCode: string
    subjectCode: string
    chapterName: string
    year: string
    difficulty: string
    tags: string
    stemText: string
    stemLatex: string
    optionAText: string; optionALatex: string
    optionBText: string; optionBLatex: string
    optionCText: string; optionCLatex: string
    optionDText: string; optionDLatex: string
    correctAnswer: string
    rationaleA: string; rationaleB: string; rationaleC: string; rationaleD: string
    explanationText: string; explanationLatex: string
    sourceNote: string
    aiAssisted: boolean
    allowMultipleCorrect: boolean
  }

  const rows: RawRow[] = []
  sheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return // header
    const currCode = cell(row, "curriculum_code")
    const stemText = cell(row, "stem_text")
    if (!currCode && !stemText) return // skip empty rows
    rows.push({
      rowNum,
      curriculumCode: currCode,
      subjectCode: cell(row, "subject_code"),
      chapterName: cell(row, "chapter_name"),
      year: cell(row, "year"),
      difficulty: cell(row, "difficulty") || "MEDIUM",
      tags: cell(row, "tags"),
      stemText,
      stemLatex: cell(row, "stem_latex"),
      optionAText: cell(row, "option_a_text"), optionALatex: cell(row, "option_a_latex"),
      optionBText: cell(row, "option_b_text"), optionBLatex: cell(row, "option_b_latex"),
      optionCText: cell(row, "option_c_text"), optionCLatex: cell(row, "option_c_latex"),
      optionDText: cell(row, "option_d_text"), optionDLatex: cell(row, "option_d_latex"),
      correctAnswer: cell(row, "correct_answer").toUpperCase(),
      rationaleA: cell(row, "rationale_a"), rationaleB: cell(row, "rationale_b"),
      rationaleC: cell(row, "rationale_c"), rationaleD: cell(row, "rationale_d"),
      explanationText: cell(row, "explanation_text"), explanationLatex: cell(row, "explanation_latex"),
      sourceNote: cell(row, "source_note"),
      aiAssisted: bool(cell(row, "ai_assisted")),
      allowMultipleCorrect: bool(cell(row, "allow_multiple_correct")),
    })
  })

  if (rows.length === 0) {
    return NextResponse.json({ error: "No data rows found in the Questions sheet." }, { status: 400 })
  }
  if (rows.length > 200) {
    return NextResponse.json({ error: "Maximum 200 questions per import." }, { status: 400 })
  }

  // ── Resolve DB entities in batch ──────────────────────────────────────────
  const uniqueCurrCodes = [...new Set(rows.map((r) => r.curriculumCode))]
  const curriculaRecords = await prisma.curriculum.findMany({
    where: { code: { in: uniqueCurrCodes } },
    select: { id: true, code: true },
  })
  const currById: Record<string, string> = Object.fromEntries(curriculaRecords.map((c) => [c.code, c.id]))

  const allSubjects = await prisma.subject.findMany({
    where: { curriculumId: { in: Object.values(currById) } },
    select: { id: true, code: true, curriculumId: true },
  })
  const subjectByKey: Record<string, string> = {}
  for (const s of allSubjects) subjectByKey[`${s.curriculumId}::${s.code.toUpperCase()}`] = s.id

  const allChapters = await prisma.chapter.findMany({
    where: { subjectId: { in: allSubjects.map((s) => s.id) } },
    select: { id: true, name: true, subjectId: true },
  })
  const chapterByKey: Record<string, string> = {}
  for (const ch of allChapters) chapterByKey[`${ch.subjectId}::${ch.name}`] = ch.id

  // ── Process rows ──────────────────────────────────────────────────────────
  const results: { index: number; id?: string; error?: string }[] = []
  const VALID_DIFFICULTIES = ["EASY", "MEDIUM", "HARD", "CHALLENGE"]
  const ANSWER_MAP: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const idx = r.rowNum - 2 // 0-based for display

    if (!r.curriculumCode) { results.push({ index: idx, error: `Row ${r.rowNum}: curriculum_code is required` }); continue }
    if (!r.subjectCode) { results.push({ index: idx, error: `Row ${r.rowNum}: subject_code is required` }); continue }
    if (!r.chapterName) { results.push({ index: idx, error: `Row ${r.rowNum}: chapter_name is required` }); continue }
    if (!r.stemText && !r.stemLatex) { results.push({ index: idx, error: `Row ${r.rowNum}: stem_text or stem_latex is required` }); continue }
    if (!["A","B","C","D"].includes(r.correctAnswer)) { results.push({ index: idx, error: `Row ${r.rowNum}: correct_answer must be A, B, C, or D` }); continue }

    const difficulty = (VALID_DIFFICULTIES.includes(r.difficulty) ? r.difficulty : "MEDIUM") as QuestionDifficulty

    const currId = currById[r.curriculumCode]
    if (!currId) { results.push({ index: idx, error: `Row ${r.rowNum}: Curriculum '${r.curriculumCode}' not found` }); continue }

    const subjectId = subjectByKey[`${currId}::${r.subjectCode.toUpperCase()}`]
    if (!subjectId) { results.push({ index: idx, error: `Row ${r.rowNum}: Subject '${r.subjectCode}' not found in ${r.curriculumCode}` }); continue }

    const chapterId = chapterByKey[`${subjectId}::${r.chapterName}`]
    if (!chapterId) { results.push({ index: idx, error: `Row ${r.rowNum}: Chapter '${r.chapterName}' not found in subject '${r.subjectCode}'` }); continue }

    // Build content
    const stem = buildBlocks(r.stemText, r.stemLatex)
    if (stem.length === 0) { results.push({ index: idx, error: `Row ${r.rowNum}: stem is empty` }); continue }

    const correctIdx = ANSWER_MAP[r.correctAnswer]
    const optionDefs = [
      { text: r.optionAText, latex: r.optionALatex, rationale: r.rationaleA },
      { text: r.optionBText, latex: r.optionBLatex, rationale: r.rationaleB },
      { text: r.optionCText, latex: r.optionCLatex, rationale: r.rationaleC },
      { text: r.optionDText, latex: r.optionDLatex, rationale: r.rationaleD },
    ]

    const options = optionDefs
      .map((o, idx2) => {
        const blocks = buildBlocks(o.text, o.latex)
        if (blocks.length === 0) return null
        return {
          content: blocks.length === 1 ? blocks[0] : { kind: "mixed" as const, blocks },
          isCorrect: idx2 === correctIdx,
          rationale: o.rationale || null,
          sortOrder: idx2,
        }
      })
      .filter((o): o is NonNullable<typeof o> => o !== null)

    if (options.length < 2) { results.push({ index: idx, error: `Row ${r.rowNum}: at least 2 options with text are required` }); continue }

    const explanation = buildBlocks(r.explanationText, r.explanationLatex)

    // Build tags: year + comma-sep tags
    const tags: string[] = []
    if (r.year) tags.push(r.year)
    for (const t of r.tags.split(",").map((t) => t.trim()).filter(Boolean)) {
      if (!tags.includes(t)) tags.push(t)
    }

    try {
      const yearInt = r.year ? parseInt(r.year, 10) : null
      const created = await prisma.question.create({
        data: {
          subjectId,
          chapterId,
          stem,
          explanation,
          difficulty,
          year: yearInt && !isNaN(yearInt) ? yearInt : null,
          allowMultipleCorrect: r.allowMultipleCorrect,
          tags,
          sourceNote: r.sourceNote || null,
          aiAssisted: r.aiAssisted,
          status: "DRAFT",
          authorId: session!.user!.id,
          options: {
            create: options.map((o) => ({
              content: o.content,
              isCorrect: o.isCorrect,
              rationale: o.rationale,
              sortOrder: o.sortOrder,
            })),
          },
        },
        select: { id: true },
      })
      results.push({ index: idx, id: created.id })
    } catch (err) {
      results.push({ index: idx, error: `Row ${r.rowNum}: database error — ${err instanceof Error ? err.message : "unknown"}` })
    }
  }

  const created = results.filter((r) => r.id).length
  const failed = results.filter((r) => r.error).length

  return NextResponse.json({ created, failed, results })
}
