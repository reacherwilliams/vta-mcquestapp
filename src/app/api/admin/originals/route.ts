import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canViewOriginals } from "@/lib/permissions"
import { encrypt } from "@/lib/originals/crypto"
import { originalToText } from "@/lib/originals/text"
import { embed } from "@/lib/originals/embed"
import { setOriginalEmbedding } from "@/lib/originals/similarity"
import { writeAudit } from "@/lib/audit"

async function assertSA() {
  const session = await auth()
  if (!session?.user?.id) return null
  return canViewOriginals(session.user.role) ? session.user.id : null
}

// List originals — metadata + citation ONLY, never the encrypted text.
export async function GET(req: Request) {
  if (!await assertSA()) return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const syllabusCode = searchParams.get("syllabusCode") ?? undefined

  const items = await prisma.originalQuestion.findMany({
    where: { ...(syllabusCode ? { syllabusCode } : {}) },
    select: {
      id: true, board: true, syllabusCode: true, subjectName: true, level: true,
      session: true, year: true, paper: true, variant: true, questionNumber: true,
      tier: true, answer: true, citation: true, createdAt: true,
      // NOTE: stemCipher / optionsCipher are intentionally NOT selected.
    },
    orderBy: [{ syllabusCode: "asc" }, { year: "desc" }, { paper: "asc" }, { questionNumber: "asc" }],
    take: 500,
  })
  return NextResponse.json(items)
}

// Create an original — encrypts the expressive content before storing.
export async function POST(req: Request) {
  const adminId = await assertSA()
  if (!adminId) return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  let body: {
    syllabusCode?: string; subjectName?: string; level?: string; session?: string
    year?: number; paper?: number; variant?: number; questionNumber?: number
    tier?: string | null; stem?: string; options?: unknown; answer?: string; citation?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  const { syllabusCode, subjectName, level, session, year, paper, variant, questionNumber, answer, citation } = body
  if (!syllabusCode || !subjectName || !level || !session || !year || !paper || !variant || !questionNumber || !answer || !citation) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 })
  }
  if (!body.stem || body.options == null) {
    return NextResponse.json({ error: "stem and options are required." }, { status: 400 })
  }

  try {
    const created = await prisma.originalQuestion.create({
      data: {
        syllabusCode, subjectName, level, session, year, paper, variant, questionNumber,
        tier: body.tier ?? null,
        answer,
        citation,
        stemCipher: encrypt(body.stem),
        optionsCipher: encrypt(JSON.stringify(body.options)),
        createdById: adminId,
      },
      select: { id: true, citation: true },
    })

    // Embed from the plaintext (while we still have it) so the row is searchable.
    // Embedding is local/in-house (Transformers.js) — text never leaves our infra.
    // Non-fatal: if it fails, the row is stored but won't be matched until re-embedded.
    let embedded = true
    try {
      const options = Array.isArray(body.options) ? (body.options as { text?: string }[]) : []
      const text = originalToText(body.stem, options.map((o) => ({ text: o.text ?? "" })))
      const vec = await embed(text)
      await setOriginalEmbedding(created.id, vec)
    } catch (e) {
      embedded = false
      console.warn("[originals] embedding skipped:", (e as Error).message)
    }

    writeAudit(adminId, "ORIGINAL_CREATED", "OriginalQuestion", created.id, { citation: created.citation })
    return NextResponse.json({ ...created, embedded }, { status: 201 })
  } catch (err) {
    // Unique constraint (same paper+Q already ingested) or encryption failure.
    const msg = (err as Error).message.includes("Unique")
      ? "This question (same syllabus/session/paper/variant/number) is already in the bank."
      : "Could not save — check ENCRYPTION_KEY is configured."
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
