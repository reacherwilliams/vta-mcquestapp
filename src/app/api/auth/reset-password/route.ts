import "server-only"
import { NextResponse } from "next/server"
import { createHash } from "crypto"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"

// Complete a password reset. Body: { token, password }
export async function POST(req: Request) {
  let body: { token?: string; password?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  const token = body.token?.trim()
  const password = body.password ?? ""
  if (!token) {
    return NextResponse.json({ error: "Missing reset token." }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
  }

  const tokenHash = createHash("sha256").update(token).digest("hex")
  const user = await prisma.user.findUnique({
    where: { passwordResetToken: tokenHash },
    select: { id: true, passwordResetExpiresAt: true },
  })

  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "This reset link is invalid or has expired. Request a new one." }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(password, 12),
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    },
  })

  writeAudit(user.id, "PASSWORD_RESET", "User", user.id, {})

  return NextResponse.json({ ok: true })
}
