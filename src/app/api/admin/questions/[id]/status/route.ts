import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { writeAudit } from "@/lib/audit"
import { transitionStatus, LifecycleError, type TransitionAction } from "@/lib/questions/lifecycle"
import type { UserRole } from "@prisma/client"

const VALID_ACTIONS: TransitionAction[] = [
  "submit", "approve", "needs_changes", "reject", "reassign", "archive", "restore",
]

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const action = body.action as TransitionAction
  const note = typeof body.note === "string" ? body.note : undefined
  const reassignToUserId = typeof body.reassignToUserId === "string" ? body.reassignToUserId : undefined

  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` }, { status: 400 })
  }

  try {
    const updated = await transitionStatus({
      questionId: id,
      action,
      actor: { id: session.user.id, role: session.user.role as UserRole },
      note,
      reassignToUserId,
    })

    writeAudit(session.user.id, "QUESTION_STATUS_CHANGED", "Question", id, {
      action,
      newStatus: updated.status,
      ...(note ? { note } : {}),
      ...(reassignToUserId ? { reassignToUserId } : {}),
    })

    return NextResponse.json({ id: updated.id, status: updated.status })
  } catch (err) {
    if (err instanceof LifecycleError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
