import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { nanoid } from "nanoid"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  const userId = session.user.id

  // One squad per user
  const existing = await prisma.squadMember.findFirst({ where: { userId } })
  if (existing) {
    return NextResponse.json({ error: "You are already in a squad." }, { status: 409 })
  }

  let body: { name?: string }
  try { body = await req.json() } catch { body = {} }

  const name = (body.name ?? "").trim()
  if (!name || name.length > 40) {
    return NextResponse.json({ error: "Squad name must be 1–40 characters." }, { status: 400 })
  }

  const inviteCode = nanoid(8).toUpperCase()

  const squad = await prisma.squad.create({
    data: {
      name,
      inviteCode,
      createdById: userId,
      members: { create: { userId, isLeader: true } },
    },
    select: { id: true, name: true, inviteCode: true },
  })

  return NextResponse.json(squad, { status: 201 })
}
