import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import ExcelJS from "exceljs"

function isAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

export async function GET() {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  // ── Fetch DB hierarchy ────────────────────────────────────────────────────
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
          subjName: s.name,
          chapName: ch.name,
          ibLevel: ch.ibLevel ?? "",
        })
      }
    }
  }

  // ─ Main "Questions" sheet ─────────────────────────────────────────────────
  const sheetQ = wb.addWorksheet("Questions")

  const COLS = [
    { header: "curriculum_code *",     key: "curriculum_code",     width: 18 },
    { header: "subject_code *",        key: "subject_code",        width: 18 },
    { header: "chapter_name *",        key: "chapter_name",        width: 36 },
    { header: "year",                  key: "year",                width: 10 },
    { header: "difficulty *",          key: "difficulty",          width: 14 },
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

  // Data validation for rows 2–201
  const curriculumCodes = curricula.map(([c]) => c)

  // curriculum_code dropdown (inline if ≤ 255 chars total)
  const currList = `"${curriculumCodes.join(",")}"`
  if (currList.length <= 255) {
    for (let r = 2; r <= 201; r++) {
      sheetQ.getCell(`A${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [currList],
        showErrorMessage: true,
        errorTitle: "Invalid curriculum",
        error: `Must be one of: ${curriculumCodes.join(", ")}`,
      }
    }
  }

  // difficulty dropdown
  for (let r = 2; r <= 201; r++) {
    sheetQ.getCell(`E${r}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"EASY,MEDIUM,HARD,CHALLENGE"'],
      showErrorMessage: true,
      errorTitle: "Invalid difficulty",
      error: "Must be EASY, MEDIUM, HARD, or CHALLENGE",
    }
    // correct_answer dropdown (column Q = 17)
    sheetQ.getCell(`Q${r}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"A,B,C,D"'],
      showErrorMessage: true,
      errorTitle: "Invalid answer",
      error: "Must be A, B, C, or D",
    }
    // ai_assisted dropdown (column Y = 25)
    sheetQ.getCell(`Y${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"TRUE,FALSE"'],
    }
    // allow_multiple_correct dropdown (column Z = 26)
    sheetQ.getCell(`Z${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"TRUE,FALSE"'],
    }
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

  sheetQ.addRow({
    curriculum_code: sampleSubject?.curriculum.code ?? "IGCSE",
    subject_code:    sampleSubject?.code ?? "PHY",
    chapter_name:    sampleChapter?.name ?? "Forces and Motion",
    year:            "2024",
    difficulty:      "MEDIUM",
    tags:            "Paper 1",
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
    ["TAGS"],
    ["• Use the 'year' column for the exam year (e.g. 2024)."],
    ["• Use 'tags' for extra labels separated by commas (e.g. Paper 1, HL, Kinematics)."],
  ]

  for (const [i, row] of instructions.entries()) {
    const wsRow = sheetInfo.addRow(row)
    if (i === 0) {
      wsRow.font = { bold: true, size: 14, color: { argb: "FF3F6212" } }
    } else if (row[0].startsWith("HOW") || row[0].startsWith("LATEX") || row[0].startsWith("DIFFICULTY") || row[0].startsWith("LEGAL") || row[0].startsWith("TAGS")) {
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
