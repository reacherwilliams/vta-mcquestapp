import "server-only"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

/**
 * Vercel Cron — runs Sundays at 08:00 UTC.
 * vercel.json: { "path": "/api/cron/recommendations", "schedule": "0 8 * * 0" }
 *
 * For each active user who practised in the last 7 days:
 * - Finds their weakest chapter (<60% mastery, ≥5 attempts)
 * - Sends a short "weakness report" email via Resend
 */

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // Find users who practised in the last 7 days
  const activeUserIds = await prisma.attempt.groupBy({
    by: ["userId"],
    where: { createdAt: { gte: weekAgo } },
    _count: { userId: true },
    having: { userId: { _count: { gte: 5 } } },
  })

  let sent = 0
  let skipped = 0

  for (const { userId } of activeUserIds) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      })
      if (!user) continue

      // Find weakest chapter
      const attempts = await prisma.attempt.findMany({
        where: { userId, createdAt: { gte: weekAgo } },
        select: { questionId: true, isCorrect: true },
      })

      const qIds = [...new Set(attempts.map((a) => a.questionId))]
      const questions = await prisma.question.findMany({
        where: { id: { in: qIds } },
        select: { id: true, chapterId: true, chapter: { select: { name: true } } },
      })
      const qMap = new Map(questions.map((q) => [q.id, q]))

      const chapterStats = new Map<string, { name: string; correct: number; total: number }>()
      for (const a of attempts) {
        const q = qMap.get(a.questionId)
        if (!q) continue
        const key = q.chapterId
        const s = chapterStats.get(key) ?? { name: q.chapter.name, correct: 0, total: 0 }
        s.total++
        if (a.isCorrect) s.correct++
        chapterStats.set(key, s)
      }

      const weakest = [...chapterStats.entries()]
        .filter(([, s]) => s.total >= 5 && s.correct / s.total < 0.6)
        .sort(([, a], [, b]) => a.correct / a.total - b.correct / b.total)[0]

      if (!weakest) { skipped++; continue }

      const [, { name, correct, total }] = weakest
      const pct = Math.round((correct / total) * 100)

      await sendEmail({
        to: user.email,
        subject: `Your weekly weakness report — ${name}`,
        html: `
          <p>Hi ${user.firstName},</p>
          <p>This week, your weakest area was <strong>${name}</strong> — you got <strong>${pct}%</strong> correct (${correct}/${total} answers).</p>
          <p>Spending 15 minutes drilling ${name} questions could significantly boost your mastery before your next exam.</p>
          <p><a href="https://mcq-masterloop.com/practice/filter" style="background:#65a30d;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Drill ${name} now →</a></p>
          <p>Keep going — every question counts.</p>
          <p>— The MCQ MasterLoop team</p>
          <hr/>
          <p style="font-size:11px;color:#888">You're receiving this because you have an MCQ MasterLoop account. <a href="https://mcq-masterloop.com/profile">Manage notifications</a></p>
        `,
      })

      sent++
    } catch {
      // Don't let one user failure break the batch
      skipped++
    }
  }

  return NextResponse.json({ processed: activeUserIds.length, sent, skipped })
}
