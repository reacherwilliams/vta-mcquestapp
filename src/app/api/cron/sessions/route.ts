import "server-only"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Vercel Cron — runs hourly.
 * Configured in vercel.json: { "path": "/api/cron/sessions", "schedule": "0 * * * *" }
 *
 * Marks any IN_PROGRESS PracticeSession older than 24 h as ABANDONED.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const { count } = await prisma.practiceSession.updateMany({
    where: {
      status: "IN_PROGRESS",
      startedAt: { lt: cutoff },
    },
    data: { status: "ABANDONED" },
  })

  return NextResponse.json({ abandoned: count })
}
