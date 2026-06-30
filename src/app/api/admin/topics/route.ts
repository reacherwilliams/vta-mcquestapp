import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminTier } from "@/lib/permissions"

// Topic tree for one subject — powers the topic picker in the question editor.
export async function GET(req: Request) {
  const session = await auth()
  if (!isAdminTier(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }
  const subjectId = new URL(req.url).searchParams.get("subjectId")
  if (!subjectId) return NextResponse.json([])

  const topics = await prisma.topic.findMany({
    where: { subjectId },
    select: { id: true, parentId: true, code: true, title: true, level: true },
    orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
  })
  return NextResponse.json(topics)
}
