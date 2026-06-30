import "server-only"
import { prisma } from "@/lib/prisma"
import { embed } from "./embed"
import type { ParsedCitation } from "./citation"

// pgvector literal: [0.1,0.2,...]
function vectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`
}

/** Store an original's embedding (Prisma can't write Unsupported types — raw SQL). */
export async function setOriginalEmbedding(id: string, vec: number[]): Promise<void> {
  const lit = vectorLiteral(vec)
  await prisma.$executeRaw`UPDATE original_questions SET embedding = ${lit}::vector WHERE id = ${id}`
}

export type SimMatch = { id: string; citation: string; score: number }

/** Cosine similarity search against embedded originals in the same subject. */
export async function findSimilarOriginals(vec: number[], subjectName: string, limit = 5): Promise<SimMatch[]> {
  const lit = vectorLiteral(vec)
  const rows = await prisma.$queryRaw<{ id: string; citation: string; score: number }[]>`
    SELECT id, citation, 1 - (embedding <=> ${lit}::vector) AS score
    FROM original_questions
    WHERE embedding IS NOT NULL AND "subjectName" = ${subjectName}
    ORDER BY embedding <=> ${lit}::vector
    LIMIT ${limit}
  `
  return rows.map((r) => ({ id: r.id, citation: r.citation, score: Number(r.score) }))
}

/** Exact/verbatim match via normalized-text hash (cheap, no embedding). */
export async function findExactByHash(normHash: string, subjectName: string): Promise<SimMatch | null> {
  const row = await prisma.originalQuestion.findFirst({
    where: { normHash, subjectName },
    select: { id: true, citation: true },
  })
  return row ? { id: row.id, citation: row.citation, score: 1 } : null
}

/** Embed arbitrary question text and return its closest originals in a subject. */
export async function checkSimilarity(text: string, subjectName: string, limit = 5): Promise<SimMatch[]> {
  const vec = await embed(text)
  return findSimilarOriginals(vec, subjectName, limit)
}

/**
 * Resolve a parsed source-note citation to a specific original in the bank.
 * Matches on whatever fields the citation provided; when session/year are
 * omitted we take the most recent paper+number match.
 */
export async function findCitedOriginal(c: ParsedCitation): Promise<SimMatch | null> {
  const row = await prisma.originalQuestion.findFirst({
    where: {
      syllabusCode: c.syllabusCode,
      ...(c.paper != null ? { paper: c.paper } : {}),
      ...(c.variant != null ? { variant: c.variant } : {}),
      ...(c.session ? { session: c.session } : {}),
      ...(c.year != null ? { year: c.year } : {}),
      ...(c.questionNumber != null ? { questionNumber: c.questionNumber } : {}),
    },
    select: { id: true, citation: true },
    orderBy: [{ year: "desc" }, { variant: "asc" }],
  })
  return row ? { id: row.id, citation: row.citation, score: 1 } : null
}

/** Cosine similarity of a pre-computed vector to one specific original. */
export async function scoreOriginalById(vec: number[], id: string): Promise<number | null> {
  const lit = vectorLiteral(vec)
  const rows = await prisma.$queryRaw<{ score: number }[]>`
    SELECT 1 - (embedding <=> ${lit}::vector) AS score
    FROM original_questions
    WHERE id = ${id} AND embedding IS NOT NULL
  `
  return rows[0] ? Number(rows[0].score) : null
}
