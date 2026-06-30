import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminTier } from "@/lib/permissions"
import { questionToText } from "@/lib/originals/text"
import { normalizedHash } from "@/lib/originals/hash"
import { embed } from "@/lib/originals/embed"
import { findSimilarOriginals, findExactByHash, findCitedOriginal, scoreOriginalById } from "@/lib/originals/similarity"
import { parseCitation } from "@/lib/originals/citation"

// Cross-check ONE contributor question against the Original Question Bank.
// Embeds the question, finds the nearest originals in the same subject, and
// stores the top match (score + citation) on the question for the review/QA UI.
// If the source note cites a specific original ("inspired by 0625/22 Q5"), also
// resolves that original and scores the question against it — so the claim is
// verified, not just asserted.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id || !isAdminTier(session.user.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }
  const { id } = await params

  const q = await prisma.question.findUnique({
    where: { id },
    select: {
      id: true,
      stem: true,
      sourceNote: true,
      subject: { select: { name: true } },
      options: { select: { content: true } },
    },
  })
  if (!q) return NextResponse.json({ error: "Question not found." }, { status: 404 })

  const text = questionToText(q.stem, q.options)
  if (!text) return NextResponse.json({ error: "Question has no comparable text." }, { status: 400 })

  let matches
  let exact: Awaited<ReturnType<typeof findExactByHash>> = null
  let cited: { citation: string; originalId: string; score: number | null; found: true } | { citation: string; found: false } | null = null
  try {
    // Embed once, reuse for both the subject-pool search and the cited check.
    const vec = await embed(text)
    // Exact (verbatim) check is cheap; semantic embedding catches rewordings.
    exact = await findExactByHash(normalizedHash(text), q.subject.name)
    matches = await findSimilarOriginals(vec, q.subject.name, 5)

    // Verify an "inspired by …" claim against the specific cited original.
    const parsed = parseCitation(q.sourceNote)
    if (parsed) {
      const orig = await findCitedOriginal(parsed)
      cited = orig
        ? { citation: orig.citation, originalId: orig.id, score: await scoreOriginalById(vec, orig.id), found: true }
        : { citation: parsed.raw, found: false }
    }
  } catch (e) {
    return NextResponse.json({ error: `Similarity check failed: ${(e as Error).message}` }, { status: 502 })
  }

  // A verbatim hash hit outranks any fuzzy semantic match.
  const top = exact ?? matches[0]
  await prisma.question.update({
    where: { id },
    data: {
      simScore: top?.score ?? 0,
      simCitation: top?.citation ?? null,
      simOriginalId: top?.id ?? null,
      simCheckedAt: new Date(),
    },
  })

  return NextResponse.json({ matches, top: top ?? null, verbatim: !!exact, cited })
}
