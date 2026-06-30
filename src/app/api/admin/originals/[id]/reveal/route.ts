import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canViewOriginals } from "@/lib/permissions"
import { decrypt } from "@/lib/originals/crypto"
import { writeAudit } from "@/lib/audit"

// Case-by-case reveal of ONE original's plaintext. Every reveal is audited.
// Optionally records the contributor question that triggered the adjudication.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id || !canViewOriginals(session.user.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }
  const { id } = await params

  let body: { reason?: string; contributorQuestionId?: string } = {}
  try { body = await req.json() } catch { /* reveal can be called with no body */ }

  const row = await prisma.originalQuestion.findUnique({
    where: { id },
    select: { id: true, citation: true, answer: true, stemCipher: true, optionsCipher: true },
  })
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 })

  // Fingerprint-only mode (Option A): no text was stored — point to the citation.
  if (!row.stemCipher || !row.optionsCipher) {
    return NextResponse.json({
      textRetained: false,
      citation: row.citation,
      answer: row.answer,
      message: `Text isn't stored (fingerprint-only mode). Open ${row.citation} in the School Support Hub to compare.`,
    })
  }

  let stem: string
  let options: unknown
  try {
    stem = decrypt(row.stemCipher)
    options = JSON.parse(decrypt(row.optionsCipher))
  } catch {
    return NextResponse.json({ error: "Decryption failed — ENCRYPTION_KEY may be wrong." }, { status: 500 })
  }

  // Audit the access — this is the record that keeps reveals controlled & accountable.
  writeAudit(session.user.id, "ORIGINAL_REVEALED", "OriginalQuestion", row.id, {
    citation: row.citation,
    ...(body.reason ? { reason: body.reason } : {}),
    ...(body.contributorQuestionId ? { contributorQuestionId: body.contributorQuestionId } : {}),
  })

  return NextResponse.json({ id: row.id, citation: row.citation, answer: row.answer, stem, options })
}
