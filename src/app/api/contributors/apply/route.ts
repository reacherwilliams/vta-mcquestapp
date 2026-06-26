import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  const userId = session.user.id

  const existing = await prisma.contributorApplication.findUnique({ where: { userId } })
  if (existing) {
    return NextResponse.json({ error: "You have already submitted an application.", status: existing.status }, { status: 409 })
  }

  let body: { statement?: string; sampleUrl?: string }
  try { body = await req.json() } catch { body = {} }

  const statement = (body.statement ?? "").trim()
  if (statement.length < 50) {
    return NextResponse.json({ error: "Statement must be at least 50 characters." }, { status: 400 })
  }

  const app = await prisma.contributorApplication.create({
    data: {
      userId,
      statement,
      sampleUrl: body.sampleUrl?.trim() || null,
    },
    select: { id: true, status: true, createdAt: true },
  })

  return NextResponse.json(app, { status: 201 })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const app = await prisma.contributorApplication.findUnique({
    where: { userId: session.user.id },
    select: { id: true, status: true, notes: true, createdAt: true },
  })

  return NextResponse.json(app ?? null)
}
