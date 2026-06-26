import type { ContentBlock, OptionContent, QuestionStem, Explanation } from "./types"

// In-memory demo questions used by /practice/demo so the practice flow is
// visible end-to-end before the database is wired up. The shape mirrors
// what `prisma/seed.ts` will insert later — same ContentBlock schema, same
// option/correctness structure — so the renderer doesn't need to change
// when the source switches to Prisma.

export type DemoOption = {
  id: string
  content: OptionContent
  isCorrect: boolean
  rationale?: string
}

export type DemoQuestion = {
  id: string
  curriculum: string
  subject: string
  chapter: string
  difficulty: "EASY" | "MEDIUM" | "HARD" | "CHALLENGE"
  tags: string[]
  stem: QuestionStem
  options: DemoOption[]
  explanation: Explanation
  allowMultipleCorrect?: boolean
}

const t = (text: string): ContentBlock => ({ kind: "text", text })
const m = (latex: string, display = false): ContentBlock => ({
  kind: "math",
  latex,
  display,
})

export const demoQuestions: DemoQuestion[] = [
  {
    id: "demo-1",
    curriculum: "IGCSE",
    subject: "Physics",
    chapter: "Forces and motion",
    difficulty: "EASY",
    tags: ["2024-style", "Paper 2", "kinematics"],
    stem: [
      t(
        "A car accelerates uniformly from rest. After 4.0 seconds it is travelling at 12 m/s. What is its acceleration?",
      ),
    ],
    options: [
      { id: "a", content: t("2.0 m/s²"), isCorrect: false, rationale: "That would give 8 m/s after 4 s." },
      { id: "b", content: t("3.0 m/s²"), isCorrect: true },
      { id: "c", content: t("4.0 m/s²"), isCorrect: false, rationale: "That would give 16 m/s after 4 s." },
      { id: "d", content: t("48 m/s²"), isCorrect: false, rationale: "You multiplied instead of dividing." },
    ],
    explanation: [
      t("Uniform acceleration from rest:"),
      m("a = \\frac{\\Delta v}{\\Delta t} = \\frac{12 - 0}{4.0} = 3.0\\ \\text{m/s}^2", true),
    ],
  },
  {
    id: "demo-2",
    curriculum: "IGCSE",
    subject: "Mathematics",
    chapter: "Algebra",
    difficulty: "MEDIUM",
    tags: ["2024-style", "Paper 4", "quadratics"],
    stem: [
      t("Solve for x:"),
      m("x^2 - 5x + 6 = 0", true),
    ],
    options: [
      { id: "a", content: m("x = 1\\ \\text{or}\\ x = 6"), isCorrect: false, rationale: "Check: 1 + 6 = 7, not 5." },
      { id: "b", content: m("x = 2\\ \\text{or}\\ x = 3"), isCorrect: true },
      { id: "c", content: m("x = -2\\ \\text{or}\\ x = -3"), isCorrect: false, rationale: "Signs are flipped." },
      { id: "d", content: m("x = 5\\ \\text{or}\\ x = 6"), isCorrect: false },
    ],
    explanation: [
      t("Factor the quadratic:"),
      m("x^2 - 5x + 6 = (x - 2)(x - 3) = 0", true),
      t("So x = 2 or x = 3."),
    ],
  },
  {
    id: "demo-3",
    curriculum: "IGCSE",
    subject: "Physics",
    chapter: "Kinematics graphs",
    difficulty: "MEDIUM",
    tags: ["2024-style", "Paper 2", "graph-options"],
    stem: [
      t(
        "A ball is thrown straight up and caught at the same height. Which graph best shows its vertical velocity v against time t?",
      ),
    ],
    options: [
      {
        id: "a",
        content: {
          kind: "graph",
          url: "/demo/graph-vt-decreasing-line.svg",
          alt: "Velocity decreasing linearly with time, crossing zero, becoming negative",
          format: "svg",
        },
        isCorrect: true,
      },
      {
        id: "b",
        content: {
          kind: "graph",
          url: "/demo/graph-vt-increasing-line.svg",
          alt: "Velocity increasing linearly with time, staying positive",
          format: "svg",
        },
        isCorrect: false,
        rationale: "Gravity decelerates the ball on the way up — velocity should decrease.",
      },
      {
        id: "c",
        content: {
          kind: "graph",
          url: "/demo/graph-vt-parabola.svg",
          alt: "Parabolic velocity curve, peaking and returning to zero",
          format: "svg",
        },
        isCorrect: false,
        rationale: "That's a position-time graph, not velocity-time.",
      },
      {
        id: "d",
        content: {
          kind: "graph",
          url: "/demo/graph-vt-flat.svg",
          alt: "Velocity constant with time",
          format: "svg",
        },
        isCorrect: false,
        rationale: "Constant velocity means no gravity — not on Earth.",
      },
    ],
    explanation: [
      t(
        "Under gravity, the ball's vertical velocity decreases linearly: positive going up, zero at the peak, negative on the way down. The graph is a straight line with constant negative slope.",
      ),
    ],
  },
  {
    id: "demo-4",
    curriculum: "IGCSE",
    subject: "Biology",
    chapter: "Cell structure",
    difficulty: "EASY",
    tags: ["2024-style", "Paper 2", "cells"],
    stem: [
      t(
        "Which structure is found in plant cells but NOT in animal cells?",
      ),
    ],
    options: [
      { id: "a", content: t("Mitochondria"), isCorrect: false, rationale: "Both plant and animal cells have mitochondria." },
      { id: "b", content: t("Cell membrane"), isCorrect: false, rationale: "Both cell types have a cell membrane." },
      { id: "c", content: t("Chloroplast"), isCorrect: true },
      { id: "d", content: t("Nucleus"), isCorrect: false, rationale: "Both have a nucleus (in eukaryotes)." },
    ],
    explanation: [
      t(
        "Chloroplasts contain chlorophyll and are the site of photosynthesis — they are found only in plant cells (and some protists), not in animal cells.",
      ),
    ],
  },
  {
    id: "demo-5",
    curriculum: "AP",
    subject: "Biology",
    chapter: "Evolution",
    difficulty: "MEDIUM",
    tags: ["2024", "MCQ"],
    allowMultipleCorrect: true,
    stem: [t("Select TWO mechanisms that can cause allele frequencies to change in a population.")],
    options: [
      { id: "a", content: t("Natural selection"), isCorrect: true },
      { id: "b", content: t("Genetic drift"), isCorrect: true },
      { id: "c", content: t("DNA replication"), isCorrect: false, rationale: "DNA replication copies existing alleles faithfully — it does not change frequencies." },
      { id: "d", content: t("Protein synthesis"), isCorrect: false, rationale: "Translation of mRNA does not alter allele frequencies." },
      { id: "e", content: t("Cellular respiration"), isCorrect: false, rationale: "Cellular respiration is a metabolic process unrelated to population genetics." },
    ],
    explanation: [
      t("Natural selection (differential reproductive success) and genetic drift (random sampling effects, especially in small populations) are both agents of microevolution that directly change allele frequencies. The others are cellular processes unrelated to population genetics."),
    ],
  },
]

export function getDemoQuestion(index: number): DemoQuestion {
  const safe = ((index % demoQuestions.length) + demoQuestions.length) % demoQuestions.length
  return demoQuestions[safe]
}
