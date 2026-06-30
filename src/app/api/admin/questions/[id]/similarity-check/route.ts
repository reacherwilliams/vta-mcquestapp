import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminTier } from "@/lib/permissions"
import { questionToText } from "@/lib/originals/text"
import { checkSimilarity } from "@/lib/originals/similarity"

// Cross-check ONE contributor question against the Original Question Bank.
// Embeds the question, finds the nearest originals in the same subject, and
// stores the top match (score + citation) on the question for the review/QA UI.
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
      subject: { select: { name: true } },
      options: { select: { content: true } },
    },
  })
  if (!q) return NextResponse.json({ error: "Question not found." }, { status: 404 })

  const text = questionToText(q.stem, q.options)
  if (!text) return NextResponse.json({ error: "Question has no comparable text." }, { status: 400 })

  let matches
  try {
    matches = await checkSimilarity(text, q.subject.name, 5)
  } catch (e) {
    return NextResponse.json({ error: `Similarity check failed: ${(e as Error).message}` }, { status: 502 })
  }

  const top = matches[0]
  await prisma.question.update({
    where: { id },
    data: {
      simScore: top?.score ?? 0,
      simCitation: top?.citation ?? null,
      simOriginalId: top?.id ?? null,
      simCheckedAt: new Date(),
    },
  })

  return NextResponse.json({ matches, top: top ?? null })
}
