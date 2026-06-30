import "server-only"
import { prisma } from "@/lib/prisma"
import { embed } from "./embed"

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

/** Embed arbitrary question text and return its closest originals in a subject. */
export async function checkSimilarity(text: string, subjectName: string, limit = 5): Promise<SimMatch[]> {
  const vec = await embed(text)
  return findSimilarOriginals(vec, subjectName, limit)
}
