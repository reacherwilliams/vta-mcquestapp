import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { id } = await params

  const entries = await prisma.marathonEntry.findMany({
    where: { eventId: id },
    orderBy: [{ score: "desc" }, { finishedAt: "asc" }],
    take: 50,
    select: {
      userId: true,
      score: true,
      xpEarned: true,
      finishedAt: true,
      user: { select: { firstName: true, lastName: true, image: true } },
    },
  })

  return NextResponse.json(
    entries.map((e, i) => ({
      rank: i + 1,
      userId: e.userId,
      firstName: e.user.firstName,
      lastName: e.user.lastName,
      image: e.user.image,
      score: e.score,
      xpEarned: e.xpEarned,
      finished: !!e.finishedAt,
      isMe: e.userId === session.user.id,
    })),
  )
}
