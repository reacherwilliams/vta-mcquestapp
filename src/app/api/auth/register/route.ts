import "server-only"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { firstName, lastName, email, password, dateOfBirth } = body as {
      firstName?: string
      lastName?: string
      email?: string
      password?: string
      dateOfBirth?: string
    }

    if (!firstName?.trim() || !lastName?.trim() || !email || !password) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }

    const normalised = email.toLowerCase().trim()
    const existing = await prisma.user.findUnique({ where: { email: normalised }, select: { id: true } })
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 })
    }

    const hash = await bcrypt.hash(password, 12)
    await prisma.user.create({
      data: {
        email: normalised,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password: hash,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        status: "ACTIVE",
      },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
