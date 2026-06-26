import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function isAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const { id: subjectId } = await params
  const chapters = await prisma.chapter.findMany({
    where: { subjectId, isActive: true },
    select: { id: true, name: true },
    orderBy: { sortOrder: "asc" },
  })

  return NextResponse.json(chapters)
}
