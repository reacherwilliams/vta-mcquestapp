import "server-only"
import { NextResponse } from "next/server"
import { createHash, randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { sendEmail, passwordResetEmail, appUrl } from "@/lib/email"

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

// Request a password reset link. Always responds 200 with the same body so an
// attacker can't use it to discover which emails have accounts (no enumeration).
export async function POST(req: Request) {
  let body: { email?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  const email = body.email?.toLowerCase().trim()
  const generic = NextResponse.json({ ok: true })
  if (!email) return generic

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, firstName: true, password: true, status: true },
  })

  // Only send for active accounts that can actually use a password.
  if (user && user.password && user.status === "ACTIVE") {
    // Email the raw token; store only its hash so a DB leak can't be used to reset.
    const rawToken = randomBytes(32).toString("hex")
    const tokenHash = createHash("sha256").update(rawToken).digest("hex")

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    })

    const resetUrl = `${appUrl()}/reset-password?token=${rawToken}`
    const { subject, html } = passwordResetEmail(user.firstName, resetUrl)
    try {
      await sendEmail({ to: email, subject, html })
    } catch (err) {
      console.error("[forgot-password] email send failed:", (err as Error).message)
    }
  }

  return generic
}
