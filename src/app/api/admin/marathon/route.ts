import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminTier } from "@/lib/permissions"

async function assertAdmin() {
  const session = await auth()
  if (!session?.user?.id) return null
  return isAdminTier(session.user.role) ? session.user.id : null
}

export async function GET() {
  if (!await assertAdmin()) return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  const events = await prisma.marathonEvent.findMany({
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      title: true,
      questionIds: true,
      startsAt: true,
      endsAt: true,
      _count: { select: { entries: true } },
    },
  })
  return NextResponse.json(events)
}

export async function POST(req: Request) {
  if (!await assertAdmin()) return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  let body: { title?: string; questionIds?: string[]; startsAt?: string; endsAt?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  const { title, questionIds, startsAt, endsAt } = body
  if (!title || !questionIds?.length || !startsAt || !endsAt) {
    return NextResponse.json({ error: "title, questionIds, startsAt, and endsAt are required." }, { status: 400 })
  }
  if (questionIds.length < 1 || questionIds.length > 20) {
    return NextResponse.json({ error: "1–20 question IDs required." }, { status: 400 })
  }

  const event = await prisma.marathonEvent.create({
    data: {
      title,
      questionIds,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
    },
  })
  return NextResponse.json(event, { status: 201 })
}

export async function DELETE(req: Request) {
  if (!await assertAdmin()) return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 })

  await prisma.marathonEvent.delete({ where: { id } })
  return NextResponse.json({ deleted: true })
}
