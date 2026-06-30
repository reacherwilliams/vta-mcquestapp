import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function isAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: RouteCtx) {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const { id } = await params
  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      chapter: { select: { id: true, name: true } },
      unit: { select: { id: true, name: true } },
      author: { select: { firstName: true, lastName: true } },
      options: { orderBy: { sortOrder: "asc" } },
    },
  })

  if (!question) return NextResponse.json({ error: "Not found." }, { status: 404 })
  return NextResponse.json(question)
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 })
  }
  const role = session.user.role as string

  const { id } = await params

  // Contributors can only edit their own questions, and only while in DRAFT.
  // Admins can edit any question regardless of status.
  if (!isAdmin(role)) {
    const existing = await prisma.question.findUnique({
      where: { id }, select: { authorId: true, status: true },
    })
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 })
    if (existing.authorId !== session.user.id || existing.status !== "DRAFT") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }
  }

  const body = await req.json()
  const {
    subjectId, chapterId, unitId, topicId,
    year,
    stem, options, explanation,
    difficulty, allowMultipleCorrect, tags, sourceNote, aiAssisted,
  } = body

  // Update question + replace options in a transaction
  const question = await prisma.$transaction(async (tx) => {
    const q = await tx.question.update({
      where: { id },
      data: {
        ...(subjectId !== undefined && { subjectId }),
        ...(chapterId !== undefined && { chapterId }),
        ...(unitId !== undefined && { unitId: unitId ?? null }),
        ...(topicId !== undefined && { topicId: topicId ?? null }),
        ...(year !== undefined && { year: year ? Number(year) : null }),
        ...(stem !== undefined && { stem }),
        ...(explanation !== undefined && { explanation }),
        ...(difficulty !== undefined && { difficulty }),
        ...(allowMultipleCorrect !== undefined && { allowMultipleCorrect }),
        ...(tags !== undefined && { tags }),
        ...(sourceNote !== undefined && { sourceNote: sourceNote ?? null }),
        ...(aiAssisted !== undefined && { aiAssisted }),
      },
      select: { id: true, status: true },
    })

    if (Array.isArray(options)) {
      await tx.questionOption.deleteMany({ where: { questionId: id } })
      await tx.questionOption.createMany({
        data: (options as { content: object; isCorrect: boolean; rationale?: string; sortOrder: number }[]).map((o) => ({
          questionId: id,
          content: o.content,
          isCorrect: o.isCorrect,
          rationale: o.rationale ?? null,
          sortOrder: o.sortOrder,
        })),
      })
    }

    return q
  })

  return NextResponse.json(question)
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const { id } = await params
  await prisma.question.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
