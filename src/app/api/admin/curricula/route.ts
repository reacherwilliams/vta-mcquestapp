import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
function isAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

export async function GET() {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const curricula = await prisma.curriculum.findMany({
    include: {
      _count: { select: { subjects: true } },
      subjects: {
        select: {
          _count: { select: { questions: true } },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  })

  const result = curricula.map((c) => ({
    id: c.id,
    code: c.code,
    displayName: c.displayName,
    description: c.description,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    _count: { subjects: c._count.subjects },
    questionCount: c.subjects.reduce((sum, s) => sum + s._count.questions, 0),
  }))

  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const body = await req.json()
  const { code, displayName, description, sortOrder = 0, isActive = true } = body

  if (!code || !displayName) {
    return NextResponse.json({ error: "code and displayName are required." }, { status: 400 })
  }

  const existing = await prisma.curriculum.findUnique({ where: { code } })
  if (existing) {
    return NextResponse.json({ error: "A curriculum with this code already exists." }, { status: 409 })
  }

  const curriculum = await prisma.curriculum.create({
    data: {
      code,
      displayName,
      description: description ?? null,
      sortOrder,
      isActive,
    },
  })

  return NextResponse.json(curriculum, { status: 201 })
}
