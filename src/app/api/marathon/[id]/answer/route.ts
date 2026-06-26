import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  const userId = session.user.id
  const { id: eventId } = await params

  const now = new Date()
  const event = await prisma.marathonEvent.findUnique({
    where: { id: eventId },
    select: { questionIds: true, startsAt: true, endsAt: true },
  })
  if (!event || event.endsAt <= now) {
    return NextResponse.json({ error: "Event not found or has ended." }, { status: 404 })
  }

  let body: { questionId: string; isCorrect: boolean }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  if (!body.questionId || body.isCorrect === undefined) {
    return NextResponse.json({ error: "questionId and isCorrect are required." }, { status: 400 })
  }
  if (!event.questionIds.includes(body.questionId)) {
    return NextResponse.json({ error: "Question not part of this event." }, { status: 400 })
  }

  // Ensure entry exists
  await prisma.marathonEntry.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { eventId, userId },
    update: {},
  })

  // How many of the marathon questions has this user attempted since event start?
  const attemptedCount = await prisma.attempt.count({
    where: { userId, questionId: { in: event.questionIds }, createdAt: { gte: event.startsAt } },
  })
  // +1 for the one we're about to record
  const isFinished = attemptedCount + 1 >= event.questionIds.length

  const xpDelta = body.isCorrect ? 5 : 0

  await prisma.marathonEntry.update({
    where: { eventId_userId: { eventId, userId } },
    data: {
      score: body.isCorrect ? { increment: 1 } : undefined,
      xpEarned: xpDelta > 0 ? { increment: xpDelta } : undefined,
      ...(isFinished ? { finishedAt: now } : {}),
    },
  })

  if (xpDelta > 0) {
    await prisma.xpLedger.create({
      data: { userId, delta: xpDelta, reason: "marathon_correct" },
    })
  }

  return NextResponse.json({ recorded: true, isFinished })
}
