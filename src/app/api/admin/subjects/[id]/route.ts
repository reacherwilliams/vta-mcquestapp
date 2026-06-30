import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function isAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { code, syllabusCode, name, description, sortOrder, hasFrq, isActive, curriculumId } = body

  const subject = await prisma.subject.update({
    where: { id },
    data: {
      ...(code !== undefined ? { code } : {}),
      ...(syllabusCode !== undefined ? { syllabusCode: syllabusCode || null } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      ...(hasFrq !== undefined ? { hasFrq } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(curriculumId !== undefined ? { curriculumId } : {}),
    },
  })

  return NextResponse.json(subject)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const { id } = await params

  const questionCount = await prisma.question.count({ where: { subjectId: id } })
  if (questionCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: this subject has ${questionCount} question(s). Remove them first.` },
      { status: 409 },
    )
  }

  await prisma.subject.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
