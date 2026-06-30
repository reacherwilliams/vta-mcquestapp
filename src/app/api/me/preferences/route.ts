import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { grantTrialEnrollments } from "@/lib/entitlements"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  const userId = session.user.id

  const body = await req.json() as {
    curriculumCodes?: string[]
    subjectCodes?: string[]
    dailyXpGoal?: number
  }

  const { curriculumCodes = [], subjectCodes = [], dailyXpGoal = 20 } = body

  // Resolve subject IDs from (curriculum code, subject code) pairs
  let enabledSubjectIds: string[] = []
  if (curriculumCodes.length > 0 && subjectCodes.length > 0) {
    const subjects = await prisma.subject.findMany({
      where: {
        curriculum: { code: { in: curriculumCodes as ("IGCSE" | "AS_LEVEL" | "A2_LEVEL" | "IB_DP" | "AP")[] } },
        code: { in: subjectCodes },
        isActive: true,
      },
      select: { id: true },
    })
    enabledSubjectIds = subjects.map((s) => s.id)
  }

  // Resolve primary curriculum ID (first chosen)
  let primaryCurriculumId: string | undefined
  if (curriculumCodes.length > 0) {
    const curr = await prisma.curriculum.findUnique({
      where: { code: curriculumCodes[0] as "IGCSE" | "AS_LEVEL" | "A2_LEVEL" | "IB_DP" | "AP" },
      select: { id: true },
    })
    primaryCurriculumId = curr?.id
  }

  // Upsert UserPreferences
  await prisma.userPreferences.upsert({
    where: { userId },
    create: {
      userId,
      primaryCurriculumId,
      enabledSubjectIds,
      dailyXpGoal: Math.max(1, Math.min(100, dailyXpGoal)),
    },
    update: {
      primaryCurriculumId,
      enabledSubjectIds,
      dailyXpGoal: Math.max(1, Math.min(100, dailyXpGoal)),
    },
  })

  // Seed Streak row if missing
  await prisma.streak.upsert({
    where: { userId },
    create: { userId, current: 0, longest: 0 },
    update: {},
  })

  // Start the free trial: grant a time-limited TRIAL enrollment for each chosen
  // subject (idempotent — won't reset an existing trial or paid access). Created
  // regardless of whether the entitlement gate is on yet, so access is ready the
  // moment it's switched on.
  const trialsGranted = await grantTrialEnrollments(userId, enabledSubjectIds)

  return NextResponse.json({ ok: true, trialsGranted })
}
