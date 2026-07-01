/**
 * Unify Chapter with the syllabus Topic tree: each top-level Topic (Area) becomes
 * a Chapter (linked via Chapter.topicId). Legacy hand-named chapters are removed
 * (questions + bounties repointed to an area chapter first). Idempotent.
 */
import { config } from "dotenv"; config({ path: ".env.local" })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
import { PrismaClient } from "@prisma/client"; import { PrismaPg } from "@prisma/adapter-pg"
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "", ssl: { rejectUnauthorized: false } }) })
async function chunks<T>(items: T[], size: number, fn: (t: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn))
}
async function main() {
  const subjects = await prisma.subject.findMany({ where: { topics: { some: { level: 1 } } }, select: { id: true } })
  let syncedSubjects = 0, areasCreated = 0, legacyRemoved = 0, qsMoved = 0
  for (const s of subjects) {
    const areas = await prisma.topic.findMany({ where: { subjectId: s.id, level: 1 }, select: { id: true, title: true, sortOrder: true }, orderBy: { sortOrder: "asc" } })
    if (!areas.length) continue
    const areaChapterIds: string[] = new Array(areas.length)
    await chunks(areas.map((a, i) => ({ a, i })), 12, async ({ a, i }) => {
      const ch = await prisma.chapter.upsert({
        where: { subjectId_name: { subjectId: s.id, name: a.title } },
        update: { topicId: a.id, sortOrder: a.sortOrder ?? i, isActive: true },
        create: { subjectId: s.id, name: a.title, topicId: a.id, sortOrder: a.sortOrder ?? i, isActive: true },
      })
      areaChapterIds[i] = ch.id
      areasCreated++
    })
    const firstArea = areaChapterIds[0]
    const legacy = await prisma.chapter.findMany({ where: { subjectId: s.id, topicId: null }, select: { id: true } })
    if (legacy.length) {
      const legacyIds = legacy.map((c) => c.id)
      qsMoved += (await prisma.question.updateMany({ where: { chapterId: { in: legacyIds } }, data: { chapterId: firstArea } })).count
      await prisma.bounty.updateMany({ where: { chapterId: { in: legacyIds } }, data: { chapterId: firstArea } })
      legacyRemoved += (await prisma.chapter.deleteMany({ where: { id: { in: legacyIds } } })).count
    }
    syncedSubjects++
  }
  console.log(`SYNCED subjects=${syncedSubjects} areaChapters=${areasCreated} legacyRemoved=${legacyRemoved} questionsMoved=${qsMoved}`)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
