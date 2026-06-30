import "server-only"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canViewOriginals } from "@/lib/permissions"
import { OriginalsClient } from "./OriginalsClient"

export const metadata = { title: "Admin — Original Question Bank" }

export default async function OriginalsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!canViewOriginals(session.user.role)) redirect("/admin")

  // Metadata + citations only — never the encrypted text.
  const items = await prisma.originalQuestion.findMany({
    select: {
      id: true, syllabusCode: true, subjectName: true, level: true,
      session: true, year: true, paper: true, variant: true, questionNumber: true,
      tier: true, answer: true, citation: true,
    },
    orderBy: [{ syllabusCode: "asc" }, { year: "desc" }, { paper: "asc" }, { questionNumber: "asc" }],
    take: 500,
  })

  // Coverage stats by syllabus (computed from metadata — no decryption).
  const byCode = new Map<string, { subjectName: string; level: string; count: number }>()
  for (const it of items) {
    const e = byCode.get(it.syllabusCode) ?? { subjectName: it.subjectName, level: it.level, count: 0 }
    e.count++
    byCode.set(it.syllabusCode, e)
  }
  const coverage = [...byCode.entries()].map(([syllabusCode, v]) => ({ syllabusCode, ...v }))
  const retainText = process.env.ORIGINALS_RETAIN_TEXT === "true"

  return <OriginalsClient items={items} coverage={coverage} total={items.length} retainText={retainText} />
}
