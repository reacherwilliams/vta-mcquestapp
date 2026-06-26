import "server-only"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"

// Change the signed-in user's password.
// Body: { currentPassword?, newPassword }
//  - If the account already has a password, currentPassword is required and must match.
//  - OAuth-only accounts (no password yet) may set one without currentPassword.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  let body: { currentPassword?: string; newPassword?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  const newPassword = body.newPassword ?? ""
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, password: true },
  })
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 })
  }

  if (user.password) {
    const ok = body.currentPassword
      ? await bcrypt.compare(body.currentPassword, user.password)
      : false
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 })
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      return NextResponse.json({ error: "New password must be different from the current one." }, { status: 400 })
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(newPassword, 12) },
  })

  writeAudit(user.id, "PASSWORD_CHANGED", "User", user.id, {})

  return NextResponse.json({ ok: true })
}
