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
  const { displayName, description, sortOrder, isActive } = body

  const curriculum = await prisma.curriculum.update({
    where: { id },
    data: {
      ...(displayName !== undefined ? { displayName } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  })

  return NextResponse.json(curriculum)
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

  const subjectCount = await prisma.subject.count({ where: { curriculumId: id } })
  if (subjectCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: this curriculum has ${subjectCount} subject(s). Remove them first.` },
      { status: 409 },
    )
  }

  await prisma.curriculum.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
