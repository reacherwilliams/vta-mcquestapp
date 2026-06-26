import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const CATEGORIES = ["bug", "bad_answer", "bad_explanation", "copyright", "other"] as const

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to report a question." }, { status: 401 })
  }

  const { id: questionId } = await params
  const body = await req.json()
  const { category, notes } = body

  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 })
  }

  // Rate-limit: one report per user per question
  const existing = await prisma.questionReport.findFirst({
    where: { questionId, reporterId: session.user.id },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ error: "You have already reported this question." }, { status: 409 })
  }

  const report = await prisma.questionReport.create({
    data: {
      questionId,
      reporterId: session.user.id,
      category,
      notes: notes?.trim() || null,
    },
    select: { id: true },
  })

  return NextResponse.json({ id: report.id }, { status: 201 })
}
