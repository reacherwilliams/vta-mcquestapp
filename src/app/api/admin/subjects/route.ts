import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function isAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

export async function GET(req: Request) {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const curriculumId = searchParams.get("curriculumId")

  const subjects = await prisma.subject.findMany({
    where: curriculumId ? { curriculumId } : undefined,
    include: {
      curriculum: { select: { id: true, code: true, displayName: true } },
      _count: { select: { chapters: true, questions: true } },
    },
    orderBy: [{ curriculum: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  })

  return NextResponse.json(subjects)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const body = await req.json()
  const {
    curriculumId,
    code,
    name,
    description,
    sortOrder = 0,
    hasFrq = false,
    isActive = true,
  } = body

  if (!curriculumId || !code || !name) {
    return NextResponse.json(
      { error: "curriculumId, code, and name are required." },
      { status: 400 },
    )
  }

  const subject = await prisma.subject.create({
    data: {
      curriculumId,
      code,
      name,
      description: description ?? null,
      sortOrder,
      hasFrq,
      isActive,
    },
  })

  return NextResponse.json(subject, { status: 201 })
}
