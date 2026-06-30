import { config } from "dotenv"
import path from "path"

config({ path: path.resolve(process.cwd(), ".env.local") })

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "",
  ssl: { rejectUnauthorized: false },
})
const prisma = new PrismaClient({ adapter })

// ─── ContentBlock helpers ─────────────────────────────────────────────────────
const t = (text: string) => ({ kind: "text", text })
const m = (latex: string, display = false) => ({ kind: "math", latex, display })

// ─── Seed data ────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Seeding MCQ MasterLoop database…")

  // ── Curriculums ──────────────────────────────────────────────────────────────
  const [igcse, as, a2, ib, ap] = await Promise.all([
    prisma.curriculum.upsert({
      where: { code: "IGCSE" },
      update: {},
      create: { code: "IGCSE", displayName: "Cambridge IGCSE", description: "Cambridge International General Certificate of Secondary Education (Grades 9–10)", sortOrder: 1 },
    }),
    prisma.curriculum.upsert({
      where: { code: "AS_LEVEL" },
      update: {},
      create: { code: "AS_LEVEL", displayName: "Cambridge AS Level", description: "Advanced Subsidiary Level (Year 12 / Lower Sixth)", sortOrder: 2 },
    }),
    prisma.curriculum.upsert({
      where: { code: "A2_LEVEL" },
      update: {},
      create: { code: "A2_LEVEL", displayName: "Cambridge A2 Level", description: "Advanced Level Year 2 (Year 13 / Upper Sixth)", sortOrder: 3 },
    }),
    prisma.curriculum.upsert({
      where: { code: "IB_DP" },
      update: {},
      create: { code: "IB_DP", displayName: "IB Diploma", description: "International Baccalaureate Diploma Programme", sortOrder: 4 },
    }),
    prisma.curriculum.upsert({
      where: { code: "AP" },
      update: {},
      create: { code: "AP", displayName: "AP (College Board)", description: "Advanced Placement — US college-level courses and exams", sortOrder: 5 },
    }),
  ])
  console.log("  ✓ Curriculums")

  // ── Subjects ──────────────────────────────────────────────────────────────────
  const subjects = await Promise.all([
    // IGCSE — CAIE syllabus codes. MATH (0580) and ENG (0500) have no MCQ paper → inactive.
    upsertSubject(igcse.id, "MATH", "Mathematics", "calculator", "#16a34a", 1, false, "0580", false),
    upsertSubject(igcse.id, "PHY",  "Physics",     "atom",       "#0284c7", 2, false, "0625"),
    upsertSubject(igcse.id, "BIO",  "Biology",     "leaf",       "#15803d", 3, false, "0610"),
    upsertSubject(igcse.id, "CHEM", "Chemistry",   "flask-conical", "#9333ea", 4, false, "0620"),
    upsertSubject(igcse.id, "ENG",  "English Language", "book-open", "#b45309", 5, false, "0500", false),
    upsertSubject(igcse.id, "COORDSCI", "Co-ordinated Sciences", "flask-conical", "#0d9488", 6, false, "0654"),
    upsertSubject(igcse.id, "ECON", "Economics", "trending-up", "#0284c7", 7, false, "0455"),
    // AS Level — share the A-Level syllabus code. MATH (9709) has no MCQ paper → inactive.
    upsertSubject(as.id, "MATH", "Mathematics", "calculator", "#16a34a", 1, false, "9709", false),
    upsertSubject(as.id, "PHY",  "Physics",     "atom",       "#0284c7", 2, false, "9702"),
    upsertSubject(as.id, "BIO",  "Biology",     "leaf",       "#15803d", 3, false, "9700"),
    upsertSubject(as.id, "CHEM", "Chemistry",   "flask-conical", "#9333ea", 4, false, "9701"),
    upsertSubject(as.id, "ECON", "Economics",   "trending-up",   "#0284c7", 5, false, "9708"),
    // A2 Level — same A-Level syllabus code as AS. MATH has no MCQ paper → inactive.
    upsertSubject(a2.id, "MATH", "Mathematics", "calculator", "#16a34a", 1, false, "9709", false),
    upsertSubject(a2.id, "PHY",  "Physics",     "atom",       "#0284c7", 2, false, "9702"),
    upsertSubject(a2.id, "BIO",  "Biology",     "leaf",       "#15803d", 3, false, "9700"),
    upsertSubject(a2.id, "CHEM", "Chemistry",   "flask-conical", "#9333ea", 4, false, "9701"),
    upsertSubject(a2.id, "ECON", "Economics",   "trending-up",   "#0284c7", 5, false, "9708"),
    // IB DP — Maths AA/AI are constructed-response only (no MCQ) → inactive.
    upsertSubject(ib.id, "MATH_AA", "Mathematics AA", "calculator", "#16a34a", 1, false, null, false),
    upsertSubject(ib.id, "MATH_AI", "Mathematics AI", "calculator", "#15803d", 2, false, null, false),
    upsertSubject(ib.id, "PHY",     "Physics",        "atom",       "#0284c7", 3),
    upsertSubject(ib.id, "BIO",     "Biology",        "leaf",       "#15803d", 4),
    upsertSubject(ib.id, "CHEM",    "Chemistry",      "flask-conical", "#9333ea", 5),
    // AP — hasFrq=true for subjects with Free Response sections
    upsertSubject(ap.id, "CALC_AB", "Calculus AB",  "calculator",    "#16a34a", 1, true),
    upsertSubject(ap.id, "CALC_BC", "Calculus BC",  "calculator",    "#15803d", 2, true),
    upsertSubject(ap.id, "PHY_1",   "Physics 1",    "atom",          "#0284c7", 3, true),
    upsertSubject(ap.id, "BIO",     "Biology",      "leaf",          "#15803d", 4, true),
    upsertSubject(ap.id, "CHEM",    "Chemistry",    "flask-conical", "#9333ea", 5, true),
    upsertSubject(ap.id, "STATS",   "Statistics",   "bar-chart-2",   "#b45309", 6, true),
    // AP — full MCQ catalogue (all have a multiple-choice section; arts portfolios + Seminar/Research excluded).
    upsertSubject(ap.id, "PHY2",     "Physics 2",                   "atom",        "#0284c7", 7,  true),
    upsertSubject(ap.id, "PHYCMECH", "Physics C: Mechanics",        "atom",        "#0369a1", 8,  true),
    upsertSubject(ap.id, "PHYCEM",   "Physics C: E&M",              "magnet",      "#0369a1", 9,  true),
    upsertSubject(ap.id, "PRECALC",  "Precalculus",                 "calculator",  "#16a34a", 10, true),
    upsertSubject(ap.id, "ENVSCI",   "Environmental Science",       "leaf",        "#15803d", 11, true),
    upsertSubject(ap.id, "PSYCH",    "Psychology",                  "brain",       "#db2777", 12, true),
    upsertSubject(ap.id, "MACRO",    "Macroeconomics",              "trending-up", "#0284c7", 13, true),
    upsertSubject(ap.id, "MICRO",    "Microeconomics",              "trending-up", "#0891b2", 14, true),
    upsertSubject(ap.id, "HUMGEO",   "Human Geography",             "globe",       "#0d9488", 15, true),
    upsertSubject(ap.id, "USHIST",   "US History",                  "landmark",    "#b45309", 16, true),
    upsertSubject(ap.id, "EUROHIST", "European History",            "landmark",    "#a16207", 17, true),
    upsertSubject(ap.id, "WHIST",    "World History",               "landmark",    "#ca8a04", 18, true),
    upsertSubject(ap.id, "USGOV",    "US Government",                "scale",       "#dc2626", 19, true),
    upsertSubject(ap.id, "COMPGOV",  "Comparative Government",       "scale",       "#ea580c", 20, true),
    upsertSubject(ap.id, "ENGLANG",  "English Language",            "book-open",   "#b45309", 21, true),
    upsertSubject(ap.id, "ENGLIT",   "English Literature",          "book-open",   "#c2410c", 22, true),
    upsertSubject(ap.id, "CSA",      "Computer Science A",          "code",        "#0284c7", 23, true),
    upsertSubject(ap.id, "CSP",      "Computer Science Principles", "code",        "#0891b2", 24, true),
    upsertSubject(ap.id, "ARTHIST",  "Art History",                 "palette",     "#db2777", 25, true),
    upsertSubject(ap.id, "MUSIC",    "Music Theory",                "music",       "#e11d48", 26, true),
    upsertSubject(ap.id, "SPAN",     "Spanish Language",            "languages",   "#ca8a04", 27, true),
    upsertSubject(ap.id, "FREN",     "French Language",             "languages",   "#0284c7", 28, true),
    upsertSubject(ap.id, "CHIN",     "Chinese Language",            "languages",   "#dc2626", 29, true),
    upsertSubject(ap.id, "JAPN",     "Japanese Language",           "languages",   "#e11d48", 30, true),
    upsertSubject(ap.id, "LATIN",    "Latin",                       "languages",   "#a16207", 31, true),
  ])
  console.log("  ✓ Subjects")

  // Idempotency: seed questions are created (not upserted) and carry NO authorId.
  // Clear prior seed runs up-front so reseeding doesn't pile up duplicates.
  // Authored/imported questions always have an authorId and are left untouched.
  // (All Question children cascade on delete.)
  const purged = await prisma.question.deleteMany({ where: { authorId: null } })
  if (purged.count) console.log(`  ✓ Cleared ${purged.count} prior seed question(s)`)

  // Map subjects by [curriculumCode, subjectCode]
  const sub = (currCode: string, subCode: string) => {
    const curriculum = { IGCSE: igcse, AS_LEVEL: as, A2_LEVEL: a2, IB_DP: ib, AP: ap }[currCode]!
    const found = subjects.find(s => s.curriculumId === curriculum.id && s.code === subCode)
    if (!found) throw new Error(`Subject not found: ${currCode}/${subCode}`)
    return found
  }

  // ── Chapters ───────────────────────────────────────────────────────────────────
  const [
    igcseMathAlgebra, igcseMathStats, igcseMathGeometry,
    igcsePhyForces, igcsePhyWaves, igcsePhyKinematics,
    igcseChemAtoms, igcseChemReactions,
    asMathDiff, asMathInteg,
    a2PhyQuantum,
    ibMathStats,
    apBioEvolution,
    apChemStoich,
    apCalcLimits,
  ] = await Promise.all([
    upsertChapter(sub("IGCSE", "MATH").id, "Algebra", 1),
    upsertChapter(sub("IGCSE", "MATH").id, "Statistics and Probability", 2),
    upsertChapter(sub("IGCSE", "MATH").id, "Geometry and Mensuration", 3),
    upsertChapter(sub("IGCSE", "PHY").id, "Forces and Motion", 1),
    upsertChapter(sub("IGCSE", "PHY").id, "Waves", 2),
    upsertChapter(sub("IGCSE", "PHY").id, "Kinematics Graphs", 3),
    upsertChapter(sub("IGCSE", "CHEM").id, "Atomic Structure", 1),
    upsertChapter(sub("IGCSE", "CHEM").id, "Chemical Reactions", 2),
    upsertChapter(sub("AS_LEVEL", "MATH").id, "Differentiation", 1),
    upsertChapter(sub("AS_LEVEL", "MATH").id, "Integration", 2),
    upsertChapter(sub("A2_LEVEL", "PHY").id, "Quantum Physics", 1),
    upsertChapter(sub("IB_DP", "MATH_AA").id, "Statistics and Probability", 1),
    upsertChapter(sub("AP", "BIO").id, "Evolution", 1),
    upsertChapter(sub("AP", "CHEM").id, "Stoichiometry", 1),
    upsertChapter(sub("AP", "CALC_AB").id, "Limits and Continuity", 1),
  ])
  console.log("  ✓ Chapters")

  // ── IGCSE Biology 0610 — full syllabus chapters ──────────────────────────────
  // The official Cambridge IGCSE Biology topic list (replaces the old 2-chapter
  // placeholder). Seeded as a named map so demo questions reference by title.
  const IGCSE_BIO_CHAPTERS = [
    "Characteristics and classification of living organisms",
    "Organisation of the organism",
    "Movement into and out of cells",
    "Biological molecules",
    "Enzymes",
    "Plant nutrition",
    "Human nutrition",
    "Transport in plants",
    "Transport in animals",
    "Diseases and immunity",
    "Gas exchange in humans",
    "Respiration",
    "Excretion in humans",
    "Coordination and response",
    "Drugs",
    "Reproduction",
    "Inheritance",
    "Variation and selection",
    "Organisms and their environment",
    "Human influences on ecosystems",
    "Biotechnology and genetic modification",
  ]
  const igcseBioChapterMap = new Map<string, { id: string }>()
  for (let i = 0; i < IGCSE_BIO_CHAPTERS.length; i++) {
    igcseBioChapterMap.set(IGCSE_BIO_CHAPTERS[i], await upsertChapter(sub("IGCSE", "BIO").id, IGCSE_BIO_CHAPTERS[i], i + 1))
  }
  const bioCh = (name: string) => igcseBioChapterMap.get(name)!
  // Drop legacy placeholder chapters (e.g. "Cell Structure", "Ecology") now that
  // the full syllabus is seeded — but only if they carry no questions, so we
  // never delete authored content.
  const removedBioCh = await prisma.chapter.deleteMany({
    where: { subjectId: sub("IGCSE", "BIO").id, name: { notIn: IGCSE_BIO_CHAPTERS }, questions: { none: {} } },
  })
  if (removedBioCh.count) console.log(`  ✓ Removed ${removedBioCh.count} legacy Biology chapter(s)`)

  // ── Questions ──────────────────────────────────────────────────────────────────

  // Helper: delete existing options and recreate question to make seed idempotent
  async function createQ({
    subjectId, chapterId, tags, stem, explanation, difficulty, status, allowMultipleCorrect = false, options,
  }: {
    subjectId: string
    chapterId: string
    tags: string[]
    stem: object[]
    explanation: object[]
    difficulty?: "EASY" | "MEDIUM" | "HARD" | "CHALLENGE"
    status?: "DRAFT" | "IN_SUBJECT_REVIEW" | "IN_CURRICULUM_REVIEW" | "PUBLISHED"
    allowMultipleCorrect?: boolean
    options: { content: object; isCorrect: boolean; rationale?: string; sortOrder: number }[]
  }) {
    const q = await prisma.question.create({
      data: {
        subjectId,
        chapterId,
        tags,
        stem,
        explanation,
        difficulty: difficulty ?? "MEDIUM",
        status: status ?? "PUBLISHED",
        allowMultipleCorrect,
        options: {
          create: options.map(o => ({
            content: o.content,
            isCorrect: o.isCorrect,
            rationale: o.rationale,
            sortOrder: o.sortOrder,
          })),
        },
      },
    })
    return q
  }

  // ── IGCSE Mathematics / Algebra ───────────────────────────────────────────────
  await createQ({
    subjectId: sub("IGCSE", "MATH").id,
    chapterId: igcseMathAlgebra.id,
    tags: ["2024", "Paper 2", "quadratics"],
    difficulty: "MEDIUM",
    stem: [t("Solve for x:"), m("x^2 - 5x + 6 = 0", true)],
    options: [
      { content: m("x = 1\\ \\text{or}\\ x = 6"), isCorrect: false, rationale: "Check: 1 + 6 = 7 ≠ 5.", sortOrder: 0 },
      { content: m("x = 2\\ \\text{or}\\ x = 3"), isCorrect: true, sortOrder: 1 },
      { content: m("x = -2\\ \\text{or}\\ x = -3"), isCorrect: false, rationale: "Signs are flipped.", sortOrder: 2 },
      { content: m("x = 5\\ \\text{or}\\ x = 6"), isCorrect: false, rationale: "These don't satisfy the equation.", sortOrder: 3 },
    ],
    explanation: [
      t("Factor the quadratic:"),
      m("x^2 - 5x + 6 = (x-2)(x-3) = 0", true),
      t("So x = 2 or x = 3."),
    ],
  })

  await createQ({
    subjectId: sub("IGCSE", "MATH").id,
    chapterId: igcseMathAlgebra.id,
    tags: ["2023", "Paper 4", "simultaneous equations"],
    difficulty: "MEDIUM",
    stem: [t("Solve the simultaneous equations:"), m("2x + y = 7", true), m("x - y = 2", true)],
    options: [
      { content: m("x = 3,\\ y = 1"), isCorrect: true, sortOrder: 0 },
      { content: m("x = 2,\\ y = 3"), isCorrect: false, rationale: "Check 2(2)+3=7 ✓ but 2-3=-1≠2.", sortOrder: 1 },
      { content: m("x = 4,\\ y = -1"), isCorrect: false, rationale: "Check 2(4)+(-1)=7 ✓ but 4-(-1)=5≠2.", sortOrder: 2 },
      { content: m("x = 1,\\ y = 5"), isCorrect: false, rationale: "Check 2(1)+5=7 ✓ but 1-5=-4≠2.", sortOrder: 3 },
    ],
    explanation: [
      t("Add the equations to eliminate y:"),
      m("(2x + y) + (x - y) = 7 + 2 \\Rightarrow 3x = 9 \\Rightarrow x = 3", true),
      t("Substitute back: y = 7 − 2(3) = 1."),
    ],
  })

  await createQ({
    subjectId: sub("IGCSE", "MATH").id,
    chapterId: igcseMathAlgebra.id,
    tags: ["2022", "Paper 2", "indices"],
    difficulty: "EASY",
    stem: [t("Simplify:"), m("\\frac{x^6 \\cdot x^{-2}}{x^3}", true)],
    options: [
      { content: m("x"), isCorrect: true, sortOrder: 0 },
      { content: m("x^2"), isCorrect: false, rationale: "6 + (−2) − 3 = 1, not 2.", sortOrder: 1 },
      { content: m("x^5"), isCorrect: false, rationale: "Don't add all exponents — you need to subtract the denominator.", sortOrder: 2 },
      { content: m("x^{11}"), isCorrect: false, rationale: "You cannot add the denominator exponent; you must subtract it.", sortOrder: 3 },
    ],
    explanation: [
      t("Using index laws:"),
      m("\\frac{x^6 \\cdot x^{-2}}{x^3} = \\frac{x^{6+(-2)}}{x^3} = \\frac{x^4}{x^3} = x^{4-3} = x^1 = x", true),
    ],
  })

  // ── IGCSE Mathematics / Statistics ───────────────────────────────────────────
  await createQ({
    subjectId: sub("IGCSE", "MATH").id,
    chapterId: igcseMathStats.id,
    tags: ["2024", "Paper 4", "probability"],
    difficulty: "MEDIUM",
    stem: [
      t("A bag contains 3 red and 5 blue balls. Two balls are drawn at random without replacement. What is the probability that both balls are red?"),
    ],
    options: [
      { content: m("\\dfrac{3}{28}"), isCorrect: true, sortOrder: 0 },
      { content: m("\\dfrac{9}{64}"), isCorrect: false, rationale: "That's with replacement (independent events).", sortOrder: 1 },
      { content: m("\\dfrac{3}{8}"),  isCorrect: false, rationale: "That's the probability of one red ball only.", sortOrder: 2 },
      { content: m("\\dfrac{1}{4}"),  isCorrect: false, rationale: "Check the denominator — 8 × 7 = 56 and ½ of that is 28.", sortOrder: 3 },
    ],
    explanation: [
      t("Without replacement:"),
      m("P(\\text{both red}) = \\frac{3}{8} \\times \\frac{2}{7} = \\frac{6}{56} = \\frac{3}{28}", true),
    ],
  })

  // ── IGCSE Physics / Forces and Motion ────────────────────────────────────────
  await createQ({
    subjectId: sub("IGCSE", "PHY").id,
    chapterId: igcsePhyForces.id,
    tags: ["2024", "Paper 2", "kinematics"],
    difficulty: "EASY",
    stem: [t("A car accelerates uniformly from rest. After 4.0 s it is travelling at 12 m/s. What is its acceleration?")],
    options: [
      { content: t("2.0 m/s²"), isCorrect: false, rationale: "That would give 8 m/s after 4 s.", sortOrder: 0 },
      { content: t("3.0 m/s²"), isCorrect: true, sortOrder: 1 },
      { content: t("4.0 m/s²"), isCorrect: false, rationale: "That would give 16 m/s after 4 s.", sortOrder: 2 },
      { content: t("48 m/s²"), isCorrect: false, rationale: "You multiplied instead of dividing.", sortOrder: 3 },
    ],
    explanation: [
      t("Uniform acceleration from rest:"),
      m("a = \\frac{\\Delta v}{\\Delta t} = \\frac{12 - 0}{4.0} = 3.0\\ \\text{m/s}^2", true),
    ],
  })

  await createQ({
    subjectId: sub("IGCSE", "PHY").id,
    chapterId: igcsePhyForces.id,
    tags: ["2023", "Paper 2", "Newton's laws"],
    difficulty: "MEDIUM",
    stem: [
      t("A 5 kg object experiences a net force of 20 N. What is its acceleration?"),
    ],
    options: [
      { content: t("1 m/s²"),  isCorrect: false, rationale: "Check: F = ma → a = F/m = 20/5.", sortOrder: 0 },
      { content: t("4 m/s²"),  isCorrect: true, sortOrder: 1 },
      { content: t("25 m/s²"), isCorrect: false, rationale: "You added instead of dividing.", sortOrder: 2 },
      { content: t("100 m/s²"),isCorrect: false, rationale: "You multiplied instead of dividing.", sortOrder: 3 },
    ],
    explanation: [
      t("Newton's Second Law:"),
      m("a = \\frac{F}{m} = \\frac{20}{5} = 4\\ \\text{m/s}^2", true),
    ],
  })

  // ── IGCSE Physics / Waves ─────────────────────────────────────────────────────
  await createQ({
    subjectId: sub("IGCSE", "PHY").id,
    chapterId: igcsePhyWaves.id,
    tags: ["2024", "Paper 2", "wave speed"],
    difficulty: "EASY",
    stem: [
      t("A wave has a frequency of 50 Hz and a wavelength of 2.0 m. What is its speed?"),
    ],
    options: [
      { content: t("25 m/s"),  isCorrect: false, rationale: "You divided instead of multiplied.", sortOrder: 0 },
      { content: t("52 m/s"),  isCorrect: false, rationale: "You added instead of multiplied.", sortOrder: 1 },
      { content: t("100 m/s"), isCorrect: true, sortOrder: 2 },
      { content: t("0.04 m/s"),isCorrect: false, rationale: "You divided the wrong way.", sortOrder: 3 },
    ],
    explanation: [
      t("Wave speed equation:"),
      m("v = f\\lambda = 50 \\times 2.0 = 100\\ \\text{m/s}", true),
    ],
  })

  // ── IGCSE Biology / Organisation of the organism ─────────────────────────────
  await createQ({
    subjectId: sub("IGCSE", "BIO").id,
    chapterId: bioCh("Organisation of the organism").id,
    tags: ["2024", "Paper 2", "cells"],
    difficulty: "EASY",
    stem: [t("Which structure is found in plant cells but NOT in animal cells?")],
    options: [
      { content: t("Mitochondria"),  isCorrect: false, rationale: "Both plant and animal cells have mitochondria.", sortOrder: 0 },
      { content: t("Cell membrane"), isCorrect: false, rationale: "Both cell types have a cell membrane.", sortOrder: 1 },
      { content: t("Chloroplast"),   isCorrect: true, sortOrder: 2 },
      { content: t("Nucleus"),       isCorrect: false, rationale: "Both eukaryotic cell types have a nucleus.", sortOrder: 3 },
    ],
    explanation: [
      t("Chloroplasts contain chlorophyll and carry out photosynthesis. They are found only in plant cells (and some protists), not in animal cells."),
    ],
  })

  await createQ({
    subjectId: sub("IGCSE", "BIO").id,
    chapterId: bioCh("Movement into and out of cells").id,
    tags: ["2023", "Paper 2", "cells", "diffusion"],
    difficulty: "MEDIUM",
    stem: [t("Which statement correctly describes osmosis?")],
    options: [
      { content: t("The net movement of solute particles from a region of high concentration to low concentration"), isCorrect: false, rationale: "That describes diffusion of solutes, not osmosis.", sortOrder: 0 },
      { content: t("The net movement of water molecules from a region of high water potential to low water potential through a partially permeable membrane"), isCorrect: true, sortOrder: 1 },
      { content: t("The active transport of water against a concentration gradient"), isCorrect: false, rationale: "Osmosis is passive — it requires no energy.", sortOrder: 2 },
      { content: t("The movement of water molecules in any direction through any membrane"), isCorrect: false, rationale: "Osmosis specifically requires a partially permeable membrane and is net movement.", sortOrder: 3 },
    ],
    explanation: [
      t("Osmosis is the net movement of water molecules from a region of high water potential (dilute solution) to low water potential (concentrated solution) across a partially permeable membrane. It is a passive process requiring no ATP."),
    ],
  })

  // ── IGCSE Chemistry / Atomic Structure ───────────────────────────────────────
  await createQ({
    subjectId: sub("IGCSE", "CHEM").id,
    chapterId: igcseChemAtoms.id,
    tags: ["2023", "Paper 2", "periodic table"],
    difficulty: "EASY",
    stem: [t("An element has atomic number 17 and mass number 35. How many neutrons does one atom of this element have?")],
    options: [
      { content: t("17"), isCorrect: false, rationale: "17 is the number of protons (atomic number).", sortOrder: 0 },
      { content: t("18"), isCorrect: true, sortOrder: 1 },
      { content: t("35"), isCorrect: false, rationale: "35 is the mass number (protons + neutrons).", sortOrder: 2 },
      { content: t("52"), isCorrect: false, rationale: "You added instead of subtracting.", sortOrder: 3 },
    ],
    explanation: [
      t("Number of neutrons = mass number − atomic number:"),
      m("\\text{neutrons} = 35 - 17 = 18", true),
    ],
  })

  await createQ({
    subjectId: sub("IGCSE", "CHEM").id,
    chapterId: igcseChemReactions.id,
    tags: ["2022", "Paper 2", "moles", "stoichiometry"],
    difficulty: "MEDIUM",
    stem: [
      t("How many moles of water are produced when 2 moles of hydrogen gas completely react with excess oxygen?"),
      m("2\\text{H}_2 + \\text{O}_2 \\rightarrow 2\\text{H}_2\\text{O}", true),
    ],
    options: [
      { content: t("1 mol"), isCorrect: false, rationale: "Look at the ratio — 2 mol H₂ gives 2 mol H₂O.", sortOrder: 0 },
      { content: t("2 mol"), isCorrect: true, sortOrder: 1 },
      { content: t("4 mol"), isCorrect: false, rationale: "The ratio is 1:1 for H₂ to H₂O.", sortOrder: 2 },
      { content: t("0.5 mol"),isCorrect: false, rationale: "You flipped the ratio.", sortOrder: 3 },
    ],
    explanation: [
      t("From the balanced equation, the molar ratio of H₂ to H₂O is 2:2 (i.e. 1:1). So 2 mol H₂ produces 2 mol H₂O."),
    ],
  })

  // ── AS Mathematics / Differentiation ─────────────────────────────────────────
  await createQ({
    subjectId: sub("AS_LEVEL", "MATH").id,
    chapterId: asMathDiff.id,
    tags: ["2024", "Paper 1", "differentiation"],
    difficulty: "MEDIUM",
    stem: [t("Find"), m("\\dfrac{dy}{dx}", false), t("when"), m("y = 3x^4 - 2x^2 + 5", true)],
    options: [
      { content: m("12x^3 - 4x"), isCorrect: true, sortOrder: 0 },
      { content: m("12x^3 - 2x"), isCorrect: false, rationale: "The coefficient of x² differentiates to 2×(−2)x = −4x.", sortOrder: 1 },
      { content: m("3x^4 - 2x"),  isCorrect: false, rationale: "You forgot to differentiate 3x⁴.", sortOrder: 2 },
      { content: m("12x^3 - 4x + 5"), isCorrect: false, rationale: "Constants differentiate to zero.", sortOrder: 3 },
    ],
    explanation: [
      t("Differentiate term by term using the power rule:"),
      m("\\frac{d}{dx}(3x^4) = 12x^3,\\quad \\frac{d}{dx}(-2x^2) = -4x,\\quad \\frac{d}{dx}(5) = 0", true),
      m("\\therefore\\quad \\frac{dy}{dx} = 12x^3 - 4x", true),
    ],
  })

  await createQ({
    subjectId: sub("AS_LEVEL", "MATH").id,
    chapterId: asMathDiff.id,
    tags: ["2023", "Paper 1", "stationary points"],
    difficulty: "HARD",
    stem: [
      t("The curve C has equation"),
      m("y = x^3 - 6x^2 + 9x + 1", true),
      t("Find the x-coordinates of the stationary points of C."),
    ],
    options: [
      { content: m("x = 1\\ \\text{and}\\ x = 3"), isCorrect: true, sortOrder: 0 },
      { content: m("x = 0\\ \\text{and}\\ x = 6"), isCorrect: false, rationale: "Set dy/dx = 0, not y = 0.", sortOrder: 1 },
      { content: m("x = 2\\ \\text{and}\\ x = 3"), isCorrect: false, rationale: "Check: 3(4)−12(2)+9 = 12−24+9 = −3 ≠ 0.", sortOrder: 2 },
      { content: m("x = -1\\ \\text{and}\\ x = 3"), isCorrect: false, rationale: "Check: 3(1)−12(−1)+9 = 3+12+9 ≠ 0.", sortOrder: 3 },
    ],
    explanation: [
      t("Differentiate and set equal to zero:"),
      m("\\frac{dy}{dx} = 3x^2 - 12x + 9 = 0 \\Rightarrow x^2 - 4x + 3 = 0 \\Rightarrow (x-1)(x-3) = 0", true),
      m("x = 1\\ \\text{or}\\ x = 3", true),
    ],
  })

  // ── A2 Physics / Quantum Physics ─────────────────────────────────────────────
  await createQ({
    subjectId: sub("A2_LEVEL", "PHY").id,
    chapterId: a2PhyQuantum.id,
    tags: ["2024", "Paper 4", "photoelectric effect"],
    difficulty: "HARD",
    stem: [
      t("Light of frequency 8.0 × 10¹⁴ Hz is incident on a metal surface with work function 3.0 × 10⁻¹⁹ J. What is the maximum kinetic energy of the emitted photoelectrons?"),
      t("(Use h = 6.63 × 10⁻³⁴ J s)"),
    ],
    options: [
      { content: m("2.3 \\times 10^{-19}\\ \\text{J}"), isCorrect: true, sortOrder: 0 },
      { content: m("5.3 \\times 10^{-19}\\ \\text{J}"), isCorrect: false, rationale: "That's the photon energy hf alone — you must subtract the work function.", sortOrder: 1 },
      { content: m("3.0 \\times 10^{-19}\\ \\text{J}"), isCorrect: false, rationale: "That's the work function φ, not the kinetic energy.", sortOrder: 2 },
      { content: m("8.6 \\times 10^{-20}\\ \\text{J}"), isCorrect: false, rationale: "Check your arithmetic on hf.", sortOrder: 3 },
    ],
    explanation: [
      t("Photoelectric equation:"),
      m("E_k^{\\max} = hf - \\phi = (6.63\\times10^{-34})(8.0\\times10^{14}) - 3.0\\times10^{-19}", true),
      m("= 5.3\\times10^{-19} - 3.0\\times10^{-19} = 2.3\\times10^{-19}\\ \\text{J}", true),
    ],
  })

  // ── IB Mathematics / Statistics ───────────────────────────────────────────────
  await createQ({
    subjectId: sub("IB_DP", "MATH_AA").id,
    chapterId: ibMathStats.id,
    tags: ["2024", "Paper 2", "normal distribution"],
    difficulty: "MEDIUM",
    stem: [
      t("A continuous random variable X follows a normal distribution with mean 50 and standard deviation 5. Find P(X > 55)."),
    ],
    options: [
      { content: m("0.1587"), isCorrect: true, sortOrder: 0 },
      { content: m("0.8413"), isCorrect: false, rationale: "That's P(X < 55) — you want the upper tail.", sortOrder: 1 },
      { content: m("0.3174"), isCorrect: false, rationale: "That's P(|X − 50| > 5) — a two-tailed result.", sortOrder: 2 },
      { content: m("0.5000"), isCorrect: false, rationale: "P(X > μ) = 0.5, but 55 > 50 so the probability is less than 0.5.", sortOrder: 3 },
    ],
    explanation: [
      t("Standardise: Z = (55 − 50)/5 = 1. From normal tables or GDC:"),
      m("P(X > 55) = P(Z > 1) = 1 - \\Phi(1) = 1 - 0.8413 = 0.1587", true),
    ],
  })

  // ── AP Biology / Evolution — MULTI-SELECT ────────────────────────────────────
  await createQ({
    subjectId: sub("AP", "BIO").id,
    chapterId: apBioEvolution.id,
    tags: ["2024", "FRQ-style", "evolution", "natural selection"],
    difficulty: "MEDIUM",
    allowMultipleCorrect: true,
    stem: [
      t("Select TWO mechanisms that can cause allele frequencies to change in a population."),
    ],
    options: [
      { content: t("Natural selection"), isCorrect: true, sortOrder: 0 },
      { content: t("Genetic drift"),     isCorrect: true, sortOrder: 1 },
      { content: t("DNA replication"),   isCorrect: false, rationale: "DNA replication copies existing alleles faithfully — it doesn't change frequencies.", sortOrder: 2 },
      { content: t("Protein synthesis"), isCorrect: false, rationale: "Translation of mRNA does not alter allele frequencies.", sortOrder: 3 },
      { content: t("Cellular respiration"), isCorrect: false, rationale: "Cellular respiration is a metabolic process unrelated to population genetics.", sortOrder: 4 },
    ],
    explanation: [
      t("The five agents of microevolution are: natural selection, genetic drift, gene flow, mutation, and non-random mating. Of the options given, natural selection (differential reproductive success) and genetic drift (random sampling effects, especially in small populations) both directly change allele frequencies."),
    ],
  })

  await createQ({
    subjectId: sub("AP", "BIO").id,
    chapterId: apBioEvolution.id,
    tags: ["2023", "MCQ", "Hardy-Weinberg"],
    difficulty: "HARD",
    allowMultipleCorrect: true,
    stem: [
      t("Which TWO conditions are required for a population to be in Hardy-Weinberg equilibrium?"),
    ],
    options: [
      { content: t("Random mating"),                       isCorrect: true, sortOrder: 0 },
      { content: t("No gene flow"),                        isCorrect: true, sortOrder: 1 },
      { content: t("Small population size"),               isCorrect: false, rationale: "Hardy-Weinberg equilibrium requires a large (ideally infinite) population size to prevent genetic drift.", sortOrder: 2 },
      { content: t("High mutation rate"),                  isCorrect: false, rationale: "Hardy-Weinberg equilibrium requires no mutations (or equal rates).", sortOrder: 3 },
      { content: t("Directional selection on all loci"),   isCorrect: false, rationale: "Hardy-Weinberg equilibrium assumes no natural selection.", sortOrder: 4 },
    ],
    explanation: [
      t("The five Hardy-Weinberg conditions are: (1) large population size, (2) random mating, (3) no mutations, (4) no gene flow, and (5) no natural selection. Random mating and no gene flow are both required; the other options listed violate H-W assumptions."),
    ],
  })

  // ── AP Chemistry / Stoichiometry — MULTI-SELECT ───────────────────────────────
  await createQ({
    subjectId: sub("AP", "CHEM").id,
    chapterId: apChemStoich.id,
    tags: ["2024", "MCQ", "limiting reagent", "stoichiometry"],
    difficulty: "MEDIUM",
    allowMultipleCorrect: true,
    stem: [
      t("Consider the reaction:"),
      m("\\text{N}_2 + 3\\text{H}_2 \\rightarrow 2\\text{NH}_3", true),
      t("Select TWO correct statements about the stoichiometry of this reaction."),
    ],
    options: [
      { content: t("3 mol H₂ are consumed for every 2 mol NH₃ produced"), isCorrect: true, sortOrder: 0 },
      { content: t("1 mol N₂ reacts with 3 mol H₂"),                       isCorrect: true, sortOrder: 1 },
      { content: t("Equal moles of N₂ and H₂ are consumed"),               isCorrect: false, rationale: "The ratio is 1:3 (N₂:H₂), not 1:1.", sortOrder: 2 },
      { content: t("2 mol NH₃ are produced from 2 mol N₂"),                isCorrect: false, rationale: "2 mol NH₃ are produced from 1 mol N₂, not 2.", sortOrder: 3 },
    ],
    explanation: [
      t("From the balanced equation N₂ + 3H₂ → 2NH₃, the molar ratios are N₂:H₂:NH₃ = 1:3:2. So 1 mol N₂ reacts with 3 mol H₂ to produce 2 mol NH₃. Equivalently, for every 2 mol NH₃ produced, 3 mol H₂ are consumed."),
    ],
  })

  // ── AP Calculus AB / Limits ───────────────────────────────────────────────────
  await createQ({
    subjectId: sub("AP", "CALC_AB").id,
    chapterId: apCalcLimits.id,
    tags: ["2024", "MCQ", "limits"],
    difficulty: "MEDIUM",
    stem: [
      t("Evaluate:"),
      m("\\lim_{x \\to 2} \\frac{x^2 - 4}{x - 2}", true),
    ],
    options: [
      { content: t("0"),         isCorrect: false, rationale: "Both numerator and denominator are 0 at x = 2 — this is an indeterminate form.", sortOrder: 0 },
      { content: t("2"),         isCorrect: false, rationale: "Factor first before substituting.", sortOrder: 1 },
      { content: t("4"),         isCorrect: true, sortOrder: 2 },
      { content: t("undefined"), isCorrect: false, rationale: "The function can be simplified — the limit exists.", sortOrder: 3 },
    ],
    explanation: [
      t("Factor the numerator:"),
      m("\\frac{x^2 - 4}{x - 2} = \\frac{(x-2)(x+2)}{x-2} = x + 2\\quad (x \\neq 2)", true),
      m("\\lim_{x \\to 2}(x + 2) = 4", true),
    ],
  })

  console.log("  ✓ Questions")

  // ── IB DP expanded chapters with SL/HL tagging ────────────────────────────────
  const ibPhys = sub("IB_DP", "PHY")
  const ibBio  = sub("IB_DP", "BIO")
  const ibChem = sub("IB_DP", "CHEM")
  const ibMathAA = sub("IB_DP", "MATH_AA")

  await Promise.all([
    // IB Physics — Topic structure (first 8 topics = SL & HL, Topics 9-12 = HL only)
    upsertChapter(ibPhys.id, "Measurements and Uncertainties",    1, "BOTH"),
    upsertChapter(ibPhys.id, "Mechanics",                         2, "BOTH"),
    upsertChapter(ibPhys.id, "Thermal Physics",                   3, "BOTH"),
    upsertChapter(ibPhys.id, "Waves",                             4, "BOTH"),
    upsertChapter(ibPhys.id, "Electricity and Magnetism",         5, "BOTH"),
    upsertChapter(ibPhys.id, "Circular Motion and Gravitation",   6, "BOTH"),
    upsertChapter(ibPhys.id, "Atomic, Nuclear and Particle Physics", 7, "BOTH"),
    upsertChapter(ibPhys.id, "Energy Production",                 8, "BOTH"),
    upsertChapter(ibPhys.id, "Wave Phenomena",                    9, "HL"),
    upsertChapter(ibPhys.id, "Fields",                           10, "HL"),
    upsertChapter(ibPhys.id, "Electromagnetic Induction",        11, "HL"),
    upsertChapter(ibPhys.id, "Quantum and Nuclear Physics",      12, "HL"),
    // IB Biology — SL/HL
    upsertChapter(ibBio.id, "Cell Biology",              1, "BOTH"),
    upsertChapter(ibBio.id, "Molecular Biology",         2, "BOTH"),
    upsertChapter(ibBio.id, "Genetics",                  3, "BOTH"),
    upsertChapter(ibBio.id, "Ecology",                   4, "BOTH"),
    upsertChapter(ibBio.id, "Evolution and Biodiversity", 5, "BOTH"),
    upsertChapter(ibBio.id, "Human Physiology",          6, "BOTH"),
    upsertChapter(ibBio.id, "Nucleic Acids",             7, "HL"),
    upsertChapter(ibBio.id, "Metabolism, Cell Respiration and Photosynthesis", 8, "HL"),
    upsertChapter(ibBio.id, "Plant Biology",             9, "HL"),
    upsertChapter(ibBio.id, "Genetics and Evolution",   10, "HL"),
    upsertChapter(ibBio.id, "Animal Physiology",        11, "HL"),
    // IB Chemistry — SL/HL
    upsertChapter(ibChem.id, "Stoichiometric Relationships",  1, "BOTH"),
    upsertChapter(ibChem.id, "Atomic Structure",              2, "BOTH"),
    upsertChapter(ibChem.id, "Periodicity",                   3, "BOTH"),
    upsertChapter(ibChem.id, "Chemical Bonding and Structure", 4, "BOTH"),
    upsertChapter(ibChem.id, "Energetics / Thermochemistry",  5, "BOTH"),
    upsertChapter(ibChem.id, "Chemical Kinetics",             6, "BOTH"),
    upsertChapter(ibChem.id, "Equilibrium",                   7, "BOTH"),
    upsertChapter(ibChem.id, "Acids and Bases",               8, "BOTH"),
    upsertChapter(ibChem.id, "Redox Processes",               9, "BOTH"),
    upsertChapter(ibChem.id, "Organic Chemistry",            10, "BOTH"),
    upsertChapter(ibChem.id, "Measurement and Data Processing", 11, "BOTH"),
    upsertChapter(ibChem.id, "Atomic Structure (HL)",        12, "HL"),
    upsertChapter(ibChem.id, "The Periodic Table (HL)",      13, "HL"),
    upsertChapter(ibChem.id, "Chemical Bonding (HL)",        14, "HL"),
    upsertChapter(ibChem.id, "Energetics (HL)",              15, "HL"),
    upsertChapter(ibChem.id, "Chemical Kinetics (HL)",       16, "HL"),
    upsertChapter(ibChem.id, "Equilibrium (HL)",             17, "HL"),
    upsertChapter(ibChem.id, "Acids and Bases (HL)",         18, "HL"),
    upsertChapter(ibChem.id, "Redox Processes (HL)",         19, "HL"),
    upsertChapter(ibChem.id, "Organic Chemistry (HL)",       20, "HL"),
    // IB Mathematics AA — SL/HL
    upsertChapter(ibMathAA.id, "Number and Algebra",          1, "BOTH"),
    upsertChapter(ibMathAA.id, "Functions",                   2, "BOTH"),
    upsertChapter(ibMathAA.id, "Geometry and Trigonometry",   3, "BOTH"),
    upsertChapter(ibMathAA.id, "Statistics and Probability",  4, "BOTH"),
    upsertChapter(ibMathAA.id, "Calculus",                    5, "BOTH"),
    upsertChapter(ibMathAA.id, "Number and Algebra (HL)",     6, "HL"),
    upsertChapter(ibMathAA.id, "Functions (HL)",              7, "HL"),
    upsertChapter(ibMathAA.id, "Geometry and Trigonometry (HL)", 8, "HL"),
    upsertChapter(ibMathAA.id, "Statistics and Probability (HL)", 9, "HL"),
    upsertChapter(ibMathAA.id, "Calculus (HL)",              10, "HL"),
  ])
  console.log("  ✓ IB DP chapter taxonomy (SL/HL)")

  // ── AP unit-structured chapters ───────────────────────────────────────────────
  const apCalcAB = sub("AP", "CALC_AB")
  const apCalcBC = sub("AP", "CALC_BC")
  const apPhy1   = sub("AP", "PHY_1")
  const apBio2   = sub("AP", "BIO")
  const apChem2  = sub("AP", "CHEM")
  const apStats2 = sub("AP", "STATS")

  await Promise.all([
    // AP Calculus AB — 8 College Board units
    upsertChapter(apCalcAB.id, "Limits and Continuity",                    1),
    upsertChapter(apCalcAB.id, "Differentiation: Definition and Fundamental Properties", 2),
    upsertChapter(apCalcAB.id, "Differentiation: Composite, Implicit, and Inverse Functions", 3),
    upsertChapter(apCalcAB.id, "Contextual Applications of Differentiation", 4),
    upsertChapter(apCalcAB.id, "Analytical Applications of Differentiation", 5),
    upsertChapter(apCalcAB.id, "Integration and Accumulation of Change",   6),
    upsertChapter(apCalcAB.id, "Differential Equations",                   7),
    upsertChapter(apCalcAB.id, "Applications of Integration",              8),
    // AP Calculus BC — adds 2 extra units
    upsertChapter(apCalcBC.id, "Limits and Continuity",                    1),
    upsertChapter(apCalcBC.id, "Differentiation",                          2),
    upsertChapter(apCalcBC.id, "Integration",                              3),
    upsertChapter(apCalcBC.id, "Differential Equations",                   4),
    upsertChapter(apCalcBC.id, "Applications of Integration",              5),
    upsertChapter(apCalcBC.id, "Parametric, Polar, and Vector Functions",  6),
    upsertChapter(apCalcBC.id, "Infinite Sequences and Series",            7),
    // AP Physics 1 — 7 units
    upsertChapter(apPhy1.id, "Kinematics",                                 1),
    upsertChapter(apPhy1.id, "Forces and Newton's Laws of Motion",         2),
    upsertChapter(apPhy1.id, "Circular Motion and Gravitation",            3),
    upsertChapter(apPhy1.id, "Energy",                                     4),
    upsertChapter(apPhy1.id, "Momentum",                                   5),
    upsertChapter(apPhy1.id, "Simple Harmonic Motion",                     6),
    upsertChapter(apPhy1.id, "Torque and Rotational Motion",               7),
    upsertChapter(apPhy1.id, "Electric Charge and Electric Force",         8),
    upsertChapter(apPhy1.id, "DC Circuits",                                9),
    upsertChapter(apPhy1.id, "Mechanical Waves and Sound",                10),
    // AP Biology — 8 units
    upsertChapter(apBio2.id, "Chemistry of Life",                          1),
    upsertChapter(apBio2.id, "Cell Structure and Function",                2),
    upsertChapter(apBio2.id, "Cellular Energetics",                        3),
    upsertChapter(apBio2.id, "Cell Communication and Cell Cycle",          4),
    upsertChapter(apBio2.id, "Heredity",                                   5),
    upsertChapter(apBio2.id, "Gene Expression and Regulation",             6),
    upsertChapter(apBio2.id, "Natural Selection",                          7),
    upsertChapter(apBio2.id, "Ecology",                                    8),
    // AP Chemistry — 9 units
    upsertChapter(apChem2.id, "Atomic Structure and Properties",           1),
    upsertChapter(apChem2.id, "Molecular and Ionic Compound Structure",    2),
    upsertChapter(apChem2.id, "Intermolecular Forces and Properties",      3),
    upsertChapter(apChem2.id, "Chemical Reactions",                        4),
    upsertChapter(apChem2.id, "Kinetics",                                  5),
    upsertChapter(apChem2.id, "Thermodynamics",                            6),
    upsertChapter(apChem2.id, "Equilibrium",                               7),
    upsertChapter(apChem2.id, "Acids and Bases",                           8),
    upsertChapter(apChem2.id, "Applications of Thermodynamics",            9),
    // AP Statistics — 9 units
    upsertChapter(apStats2.id, "Exploring One-Variable Data",              1),
    upsertChapter(apStats2.id, "Exploring Two-Variable Data",              2),
    upsertChapter(apStats2.id, "Collecting Data",                          3),
    upsertChapter(apStats2.id, "Probability, Random Variables, and PDFs",  4),
    upsertChapter(apStats2.id, "Sampling Distributions",                   5),
    upsertChapter(apStats2.id, "Inference for Categorical Data — Proportions", 6),
    upsertChapter(apStats2.id, "Inference for Quantitative Data — Means",  7),
    upsertChapter(apStats2.id, "Inference for Categorical Data — Chi-Square", 8),
    upsertChapter(apStats2.id, "Inference for Quantitative Data — Slopes", 9),
  ])
  console.log("  ✓ AP unit-structured chapters")

  // ── Exam calendar entries ──────────────────────────────────────────────────────
  const calendarEntries = [
    // CIE (IGCSE, AS, A2)
    { curriculumCode: "IGCSE",    title: "CIE May/June Paper Series",        examDate: "2026-05-01", region: "Global" },
    { curriculumCode: "IGCSE",    title: "CIE October/November Paper Series", examDate: "2026-10-01", region: "Global" },
    { curriculumCode: "AS_LEVEL", title: "AS Level May/June Series",         examDate: "2026-05-01", region: "Global" },
    { curriculumCode: "AS_LEVEL", title: "AS Level October/November Series", examDate: "2026-10-01", region: "Global" },
    { curriculumCode: "A2_LEVEL", title: "A Level May/June Series",          examDate: "2026-05-01", region: "Global" },
    { curriculumCode: "A2_LEVEL", title: "A Level October/November Series",  examDate: "2026-10-01", region: "Global" },
    // IB
    { curriculumCode: "IB_DP",    title: "IB DP May Examination Session",    examDate: "2026-05-01", region: "Global" },
    { curriculumCode: "IB_DP",    title: "IB DP November Examination Session", examDate: "2026-11-01", region: "Global" },
    // AP
    { curriculumCode: "AP",       title: "AP Exam Administration",           examDate: "2026-05-04", region: "Americas", notes: "AP exams run for ~2 weeks each May" },
  ]

  const curriculumMap = { IGCSE: igcse, AS_LEVEL: as, A2_LEVEL: a2, IB_DP: ib, AP: ap }
  for (const entry of calendarEntries) {
    const curriculum = curriculumMap[entry.curriculumCode as keyof typeof curriculumMap]
    await prisma.examCalendarEntry.upsert({
      where: {
        // no natural unique key — use title+date as surrogate
        id: `${curriculum.id}_${entry.title}`.slice(0, 30),
      },
      update: {},
      create: {
        id: `${curriculum.id}_${entry.title}`.slice(0, 30),
        curriculumId: curriculum.id,
        title: entry.title,
        examDate: new Date(entry.examDate),
        region: entry.region,
        notes: entry.notes ?? null,
      },
    })
  }
  console.log("  ✓ Exam calendar entries")

  // ── Super admin ──────────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: "reacher.williams@mcq-masterloop.com" },
    update: { role: "SUPER_ADMIN", status: "ACTIVE" },
    create: {
      email: "reacher.williams@mcq-masterloop.com",
      firstName: "Reacher",
      lastName: "Williams",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      password: await bcrypt.hash("Changeme1!", 12),
    },
  })
  console.log("  ✓ Super admin (reacher.williams@mcq-masterloop.com)")

  // ── Co-founder ───────────────────────────────────────────────────────────────
  // Oversees the Question Bank + admins; finance is view-only (no money movement).
  await prisma.user.upsert({
    where: { email: "jayesh.patole@mcq-masterloop.com" },
    update: { role: "CO_FOUNDER", status: "ACTIVE" },
    create: {
      email: "jayesh.patole@mcq-masterloop.com",
      firstName: "Jayesh",
      lastName: "Patole",
      role: "CO_FOUNDER",
      status: "ACTIVE",
      password: await bcrypt.hash("Changeme1!", 12),
    },
  })
  console.log("  ✓ Co-founder (jayesh.patole@mcq-masterloop.com)")

  console.log("\n🎉  Seed complete!")
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function upsertSubject(
  curriculumId: string,
  code: string,
  name: string,
  iconKey: string,
  accentColor: string,
  sortOrder: number,
  hasFrq = false,
  syllabusCode: string | null = null,
  isActive = true, // false for subjects with no MCQ paper (kept but hidden)
) {
  return prisma.subject.upsert({
    where: { curriculumId_code: { curriculumId, code } },
    update: { hasFrq, syllabusCode, isActive },
    create: { curriculumId, code, name, iconKey, accentColor, sortOrder, hasFrq, syllabusCode, isActive },
  })
}

async function upsertChapter(
  subjectId: string,
  name: string,
  sortOrder: number,
  ibLevel?: string,
) {
  return prisma.chapter.upsert({
    where: { subjectId_name: { subjectId, name } },
    update: { ibLevel: ibLevel ?? null },
    create: { subjectId, name, sortOrder, ibLevel: ibLevel ?? null },
  })
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
