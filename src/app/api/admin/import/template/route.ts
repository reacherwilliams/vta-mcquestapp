import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PAPER_OPTIONS, COMMAND_WORDS, SKILL_TYPES } from "@/lib/questions/tags"
import ExcelJS from "exceljs"

function isAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

// Excel column number → letter (1→A, 27→AA), so validation survives column reorders.
function colLetter(n: number): string {
  let s = ""
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) }
  return s
}

export async function GET() {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  // ── Fetch DB hierarchy (active subjects only) ─────────────────────────────
  const subjects = await prisma.subject.findMany({
    where: { isActive: true },
    include: {
      curriculum: { select: { code: true, displayName: true } },
      chapters: {
        where: { isActive: true },
        select: { name: true, ibLevel: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ curriculum: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  })

  // Syllabus topic tree (for the topic_code column lookup).
  const topics = await prisma.topic.findMany({
    where: { subject: { isActive: true } },
    select: {
      code: true, title: true,
      subject: { select: { code: true, curriculum: { select: { code: true } } } },
    },
    orderBy: [{ subject: { sortOrder: "asc" } }, { sortOrder: "asc" }, { code: "asc" }],
  })

  // Unique curricula
  const curriculaMap = new Map<string, string>()
  for (const s of subjects) curriculaMap.set(s.curriculum.code, s.curriculum.displayName)
  const curricula = [...curriculaMap.entries()]

  // ── Build workbook ────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator = "MCQ MasterLoop"
  wb.created = new Date()

  // ─ Hidden: _Curricula ─────────────────────────────────────────────────────
  const sheetCurr = wb.addWorksheet("_Curricula")
  sheetCurr.state = "hidden"
  sheetCurr.addRow(["code", "name"])
  for (const [code, name] of curricula) sheetCurr.addRow([code, name])

  // ─ Hidden: _Subjects ──────────────────────────────────────────────────────
  const sheetSubj = wb.addWorksheet("_Subjects")
  sheetSubj.state = "hidden"
  sheetSubj.addRow(["curriculum_code", "subject_code", "subject_name"])
  for (const s of subjects) sheetSubj.addRow([s.curriculum.code, s.code, s.name])

  // ─ Hidden: _Chapters ──────────────────────────────────────────────────────
  const sheetChap = wb.addWorksheet("_Chapters")
  sheetChap.state = "hidden"
  sheetChap.addRow(["curriculum_code", "subject_code", "chapter_name", "ib_level"])
  for (const s of subjects) {
    for (const ch of s.chapters) {
      sheetChap.addRow([s.curriculum.code, s.code, ch.name, ch.ibLevel ?? ""])
    }
  }

  // ─ Reference Data sheet ───────────────────────────────────────────────────
  const sheetRef = wb.addWorksheet("Reference Data")
  sheetRef.columns = [
    { header: "Curriculum Code", key: "currCode", width: 18 },
    { header: "Curriculum Name", key: "currName", width: 28 },
    { header: "Subject Code",    key: "subjCode", width: 18 },
    { header: "Syllabus Code",   key: "syllCode", width: 14 },
    { header: "Subject Name",    key: "subjName", width: 32 },
    { header: "Chapter Name",    key: "chapName", width: 40 },
    { header: "IB Level",        key: "ibLevel",  width: 12 },
  ]

  // Style header
  const refHeaderRow = sheetRef.getRow(1)
  refHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
  refHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3F6212" } }
  refHeaderRow.alignment = { vertical: "middle" }
  refHeaderRow.height = 20

  for (const s of subjects) {
    if (s.chapters.length === 0) {
      sheetRef.addRow({
        currCode: s.curriculum.code,
        currName: s.curriculum.displayName,
        subjCode: s.code,
        syllCode: s.syllabusCode ?? "",
        subjName: s.name,
        chapName: "(no chapters)",
        ibLevel: "",
      })
    } else {
      for (const ch of s.chapters) {
        sheetRef.addRow({
          currCode: s.curriculum.code,
          currName: s.curriculum.displayName,
          subjCode: s.code,
          syllCode: s.syllabusCode ?? "",
          subjName: s.name,
          chapName: ch.name,
          ibLevel: ch.ibLevel ?? "",
        })
      }
    }
  }

  // ─ Topics reference sheet — look up topic_code values ─────────────────────
  const sheetTopics = wb.addWorksheet("Topics")
  sheetTopics.columns = [
    { header: "Curriculum Code", key: "currCode", width: 18 },
    { header: "Subject Code",    key: "subjCode", width: 18 },
    { header: "Topic Code",      key: "topicCode", width: 28 },
    { header: "Topic Title",     key: "title",    width: 50 },
  ]
  const topicsHeader = sheetTopics.getRow(1)
  topicsHeader.font = { bold: true, color: { argb: "FFFFFFFF" } }
  topicsHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3F6212" } }
  for (const t of topics) {
    sheetTopics.addRow({ currCode: t.subject.curriculum.code, subjCode: t.subject.code, topicCode: t.code, title: t.title })
  }

  // ─ Main "Questions" sheet ─────────────────────────────────────────────────
  const sheetQ = wb.addWorksheet("Questions")

  const COLS = [
    { header: "curriculum_code *",     key: "curriculum_code",     width: 18 },
    { header: "subject_code *",        key: "subject_code",        width: 18 },
    { header: "chapter_name *",        key: "chapter_name",        width: 36 },
    { header: "topic_code",            key: "topic_code",          width: 22 },
    { header: "year",                  key: "year",                width: 10 },
    { header: "difficulty *",          key: "difficulty",          width: 14 },
    { header: "paper",                 key: "paper",               width: 10 },
    { header: "command_word",          key: "command_word",        width: 16 },
    { header: "skill_types (comma-sep)", key: "skill_types",       width: 24 },
    { header: "tags (comma-sep)",      key: "tags",                width: 24 },
    { header: "stem_text *",           key: "stem_text",           width: 60 },
    { header: "stem_latex",            key: "stem_latex",          width: 40 },
    { header: "option_a_text *",       key: "option_a_text",       width: 36 },
    { header: "option_a_latex",        key: "option_a_latex",      width: 28 },
    { header: "option_b_text *",       key: "option_b_text",       width: 36 },
    { header: "option_b_latex",        key: "option_b_latex",      width: 28 },
    { header: "option_c_text *",       key: "option_c_text",       width: 36 },
    { header: "option_c_latex",        key: "option_c_latex",      width: 28 },
    { header: "option_d_text *",       key: "option_d_text",       width: 36 },
    { header: "option_d_latex",        key: "option_d_latex",      width: 28 },
    { header: "correct_answer * (A-D)",key: "correct_answer",      width: 20 },
    { header: "rationale_a",           key: "rationale_a",         width: 36 },
    { header: "rationale_b",           key: "rationale_b",         width: 36 },
    { header: "rationale_c",           key: "rationale_c",         width: 36 },
    { header: "rationale_d",           key: "rationale_d",         width: 36 },
    { header: "explanation_text",      key: "explanation_text",    width: 60 },
    { header: "explanation_latex",     key: "explanation_latex",   width: 40 },
    { header: "source_note",           key: "source_note",         width: 36 },
    { header: "ai_assisted (TRUE/FALSE)", key: "ai_assisted",      width: 22 },
    { header: "allow_multiple_correct (TRUE/FALSE)", key: "allow_multiple_correct", width: 30 },
  ]
  sheetQ.columns = COLS

  // Style header row
  const hdr = sheetQ.getRow(1)
  hdr.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
  hdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3F6212" } }
  hdr.alignment = { vertical: "middle", wrapText: true }
  hdr.height = 36

  // Freeze pane below header + after col C
  sheetQ.views = [{ state: "frozen", xSplit: 3, ySplit: 1 }]

  // Column letters derived from COLS so dropdowns stay correct if columns move.
  const L = (key: string) => colLetter(COLS.findIndex((c) => c.key === key) + 1)
  const curriculumCodes = curricula.map(([c]) => c)
  const currList = `"${curriculumCodes.join(",")}"`
  const paperList = `"${PAPER_OPTIONS.join(",")}"`
  const commandList = `"${COMMAND_WORDS.join(",")}"`

  for (let r = 2; r <= 201; r++) {
    if (currList.length <= 255) {
      sheetQ.getCell(`${L("curriculum_code")}${r}`).dataValidation = {
        type: "list", allowBlank: true, formulae: [currList],
        showErrorMessage: true, errorTitle: "Invalid curriculum", error: `Must be one of: ${curriculumCodes.join(", ")}`,
      }
    }
    sheetQ.getCell(`${L("difficulty")}${r}`).dataValidation = {
      type: "list", allowBlank: false, formulae: ['"EASY,MEDIUM,HARD,CHALLENGE"'],
      showErrorMessage: true, errorTitle: "Invalid difficulty", error: "Must be EASY, MEDIUM, HARD, or CHALLENGE",
    }
    sheetQ.getCell(`${L("correct_answer")}${r}`).dataValidation = {
      type: "list", allowBlank: false, formulae: ['"A,B,C,D"'],
      showErrorMessage: true, errorTitle: "Invalid answer", error: "Must be A, B, C, or D",
    }
    sheetQ.getCell(`${L("paper")}${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [paperList] }
    sheetQ.getCell(`${L("command_word")}${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [commandList] }
    sheetQ.getCell(`${L("ai_assisted")}${r}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"TRUE,FALSE"'] }
    sheetQ.getCell(`${L("allow_multiple_correct")}${r}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"TRUE,FALSE"'] }
  }

  // Alternate row shading for readability
  for (let r = 2; r <= 201; r += 2) {
    const row = sheetQ.getRow(r)
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }
  }

  // ─ Sample row ─────────────────────────────────────────────────────────────
  // Pick first available curriculum/subject/chapter from DB for the example
  const sampleSubject = subjects[0]
  const sampleChapter = sampleSubject?.chapters[0]
  const sampleTopic = topics.find((t) => t.subject.code === sampleSubject?.code && t.subject.curriculum.code === sampleSubject?.curriculum.code)

  sheetQ.addRow({
    curriculum_code: sampleSubject?.curriculum.code ?? "IGCSE",
    subject_code:    sampleSubject?.code ?? "PHY",
    chapter_name:    sampleChapter?.name ?? "Forces and Motion",
    topic_code:      sampleTopic?.code ?? "",
    year:            "2024",
    difficulty:      "MEDIUM",
    paper:           "1",
    command_word:    "calculate",
    skill_types:     "application",
    tags:            "kinematics",
    stem_text:       "A car of mass 1200 kg accelerates from rest to 20 m/s in 8 s. What is the resultant force acting on the car?",
    stem_latex:      "",
    option_a_text:   "150 N",
    option_a_latex:  "",
    option_b_text:   "3000 N",
    option_b_latex:  "",
    option_c_text:   "9600 N",
    option_c_latex:  "",
    option_d_text:   "24000 N",
    option_d_latex:  "",
    correct_answer:  "B",
    rationale_a:     "Incorrect: 150 N is far too small for this mass.",
    rationale_b:     "Correct: F = ma = 1200 × (20/8) = 1200 × 2.5 = 3000 N",
    rationale_c:     "Incorrect: 9600 N confuses distance with acceleration.",
    rationale_d:     "Incorrect: 24000 N multiplies mass × final speed directly.",
    explanation_text: "Using Newton's second law, F = ma. First find a = Δv/t = 20/8 = 2.5 m/s². Then F = 1200 × 2.5 = 3000 N.",
    explanation_latex: "F = ma = 1200 \\times \\frac{20}{8} = 3000 \\text{ N}",
    source_note:     "Original — exam-style",
    ai_assisted:     "FALSE",
    allow_multiple_correct: "FALSE",
  })

  // Style the sample row
  const sampleRow = sheetQ.getRow(2)
  sampleRow.font = { italic: true, color: { argb: "FF6B7280" } }

  // ─ Instructions tab ───────────────────────────────────────────────────────
  const sheetInfo = wb.addWorksheet("Instructions")
  sheetInfo.getColumn(1).width = 90

  const instructions = [
    ["MCQ MasterLoop Bulk Import Template"],
    [""],
    ["HOW TO USE"],
    ["1. Fill in the 'Questions' sheet — one question per row."],
    ["2. Required columns are marked with * in the header."],
    ["3. Use the 'Reference Data' sheet to look up valid curriculum codes, subject codes, and chapter names."],
    ["4. The first row (row 2) is a sample — replace or delete it before importing."],
    ["5. Save as .xlsx and upload on the Admin › Bulk Import page."],
    [""],
    ["LATEX MATH"],
    ["• Use stem_latex / explanation_latex for display-mode equations (shown on their own line)."],
    ["• Use stem_text for inline text. You can mix — both columns are combined into a single question."],
    ["• Example: stem_text='The velocity is' + stem_latex='v = \\frac{d}{t}'"],
    ["• Common symbols: \\frac{a}{b}  x^{2}  x_{n}  \\sqrt{x}  \\pm  \\times  \\div  \\leq  \\geq  \\infty"],
    [""],
    ["DIFFICULTY GUIDE"],
    ["EASY      — ~80% of students answer correctly"],
    ["MEDIUM    — ~60% of students answer correctly"],
    ["HARD      — ~40% of students answer correctly"],
    ["CHALLENGE — <25% of students answer correctly"],
    [""],
    ["LEGAL NOTE"],
    ["• Never copy verbatim text from past papers. All questions must be original, exam-style content."],
    ["• Use 'source_note' to record inspiration (e.g. 'Inspired by 2023 Nov P1 Q14') — not verbatim text."],
    [""],
    ["SYLLABUS TOPIC"],
    ["• Optional 'topic_code' tags the question to the syllabus topic tree (e.g. " + (topics[0]?.code ?? "IGCSE.PHY.1.4") + ")."],
    ["• Look up valid codes on the 'Topics' sheet (filtered by curriculum + subject). Unknown codes are ignored."],
    [""],
    ["FACET COLUMNS (structured tags)"],
    ["• paper — the paper number (1–6). Dropdown."],
    ["• command_word — the question's command verb (define, calculate, explain…). Dropdown."],
    ["• skill_types — comma-separated skills (e.g. graph-reading, data-analysis). Options: " + SKILL_TYPES.join(", ") + "."],
    ["• These power exam-mode presets and faceted filtering — prefer them over free tags."],
    [""],
    ["TAGS"],
    ["• Use the 'year' column for the exam year (e.g. 2024)."],
    ["• Use 'tags' only for extra free-text labels not covered above (comma-separated)."],
  ]

  for (const [i, row] of instructions.entries()) {
    const wsRow = sheetInfo.addRow(row)
    if (i === 0) {
      wsRow.font = { bold: true, size: 14, color: { argb: "FF3F6212" } }
    } else if (row[0].startsWith("HOW") || row[0].startsWith("LATEX") || row[0].startsWith("DIFFICULTY") || row[0].startsWith("LEGAL") || row[0].startsWith("TAGS") || row[0].startsWith("SYLLABUS") || row[0].startsWith("FACET")) {
      wsRow.font = { bold: true, size: 11 }
    }
  }

  // ── Serialize and return ──────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="mcq-masterloop-import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  })
}
