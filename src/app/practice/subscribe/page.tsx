import "server-only"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getPricingConfig, getActiveEnrollmentSources } from "@/lib/entitlements"
import { SubscribeClient } from "./SubscribeClient"

export const metadata = { title: "Choose your subjects" }

export default async function SubscribePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const [subjects, enrollmentMap, pricing] = await Promise.all([
    prisma.subject.findMany({
      where: { isActive: true },
      select: { id: true, name: true, syllabusCode: true, code: true, curriculum: { select: { code: true, displayName: true, sortOrder: true } } },
      orderBy: [{ curriculum: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
    getActiveEnrollmentSources(userId),
    getPricingConfig(),
  ])

  return (
    <SubscribeClient
      subjects={subjects.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.syllabusCode ?? s.code,
        curriculum: s.curriculum.displayName,
      }))}
      enrollmentMap={enrollmentMap}
      pricing={pricing}
    />
  )
}
