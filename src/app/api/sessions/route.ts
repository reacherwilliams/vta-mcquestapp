import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createPracticeSession, createWrongRetrySession, createExamSession } from "@/lib/sessions/practice"
import type { SessionFilter } from "@/lib/sessions/practice"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  const userId = session.user.id
  const role = session.user.role as string | undefined

  try {
    const body = await req.json()
    const { mode, filter, limit, durationMinutes, questionCount } = body as {
      mode?: string
      filter?: SessionFilter
      limit?: number
      durationMinutes?: number
      questionCount?: number
    }

    let practiceSession
    if (mode === "WRONG_RETRY") {
      practiceSession = await createWrongRetrySession(userId)
    } else if (mode === "EXAM") {
      practiceSession = await createExamSession(
        userId,
        filter ?? {},
        durationMinutes ?? 45,
        questionCount ?? 40,
        role,
      )
    } else {
      practiceSession = await createPracticeSession(userId, filter ?? {}, limit ?? 20, role)
    }

    return NextResponse.json({ id: practiceSession.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
