import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSessionQuestion } from "@/lib/sessions/practice"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  const userId = session.user.id
  const { id: sessionId } = await params

  // Verify session ownership
  const ps = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    select: { userId: true, status: true },
  })
  if (!ps) return NextResponse.json({ error: "Session not found." }, { status: 404 })
  if (ps.userId !== userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  if (ps.status === "COMPLETED") return NextResponse.json({ error: "Session already completed." }, { status: 410 })

  const { searchParams } = new URL(req.url)
  const index = Math.max(0, Number(searchParams.get("index") ?? 0) || 0)

  const result = await getSessionQuestion(sessionId, index)
  if (!result) return NextResponse.json({ error: "No question at this index." }, { status: 404 })

  return NextResponse.json(result)
}
