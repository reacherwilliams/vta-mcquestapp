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

  const existing = await prisma.squadMember.findFirst({ where: { userId } })
  if (existing) {
    return NextResponse.json({ error: "You are already in a squad." }, { status: 409 })
  }

  let body: { inviteCode?: string }
  try { body = await req.json() } catch { body = {} }

  const code = (body.inviteCode ?? "").trim().toUpperCase()
  if (!code) {
    return NextResponse.json({ error: "inviteCode is required." }, { status: 400 })
  }

  const squad = await prisma.squad.findUnique({
    where: { inviteCode: code },
    select: { id: true, name: true, _count: { select: { members: true } } },
  })
  if (!squad) {
    return NextResponse.json({ error: "Invalid invite code." }, { status: 404 })
  }
  if (squad._count.members >= 10) {
    return NextResponse.json({ error: "Squad is full (10 members max)." }, { status: 409 })
  }

  await prisma.squadMember.create({ data: { squadId: squad.id, userId } })

  return NextResponse.json({ squadId: squad.id, name: squad.name })
}
