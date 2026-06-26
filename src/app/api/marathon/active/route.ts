import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  const userId = session.user.id
  const now = new Date()

  const event = await prisma.marathonEvent.findFirst({
    where: { startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      title: true,
      questionIds: true,
      startsAt: true,
      endsAt: true,
    },
  })

  if (!event) return NextResponse.json(null)

  // Has user already entered?
  const entry = await prisma.marathonEntry.findUnique({
    where: { eventId_userId: { eventId: event.id, userId } },
    select: { score: true, xpEarned: true, finishedAt: true },
  })

  return NextResponse.json({ event, entry: entry ?? null })
}
