/**
 * Import a curriculum Topic subtree (one subject) from a School-Core interchange
 * file into MCQuest. Idempotent — safe to re-run; updates titles/weights/order
 * and (re)links the hierarchy.
 *
 *   npx tsx scripts/import-topics.ts scripts/topics/igcse-physics-0625.json
 *
 * Interchange shape:
 *   { curriculumCode, subject, syllabusCode?, source,
 *     strands: [{ code, parentCode|null, title, level, examWeight?, sortOrder }] }
 */
import { config } from "dotenv"
import path from "path"
import fs from "fs"

config({ path: path.resolve(process.cwd(), ".env.local") })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0" // Supabase self-signed cert (local CLI)

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "",
  ssl: { rejectUnauthorized: false },
})
const prisma = new PrismaClient({ adapter })

type Strand = { code: string; parentCode: string | null; title: string; level: number; examWeight?: number | null; sortOrder?: number }
type Interchange = { curriculumCode: string; subject: string; syllabusCode?: string; source?: string; strands: Strand[] }

async function main() {
  const file = process.argv[2]
  if (!file) { console.error("Usage: import-topics.ts <interchange.json>"); process.exit(1) }

  const data = JSON.parse(fs.readFileSync(path.resolve(file), "utf8")) as Interchange
  if (!data.curriculumCode || !data.subject || !Array.isArray(data.strands)) {
    console.error("Invalid interchange: need curriculumCode, subject, strands[]."); process.exit(1)
  }

  const subject = await prisma.subject.findFirst({
    where: { name: data.subject, curriculum: { code: data.curriculumCode } },
    select: { id: true, name: true, curriculum: { select: { code: true } } },
  })
  if (!subject) {
    console.error(`No subject "${data.subject}" under curriculum "${data.curriculumCode}". Seed it first.`); process.exit(1)
  }

  // Pass 1 — upsert every strand (parent left null for now).
  for (const s of data.strands) {
    await prisma.topic.upsert({
      where: { subjectId_code: { subjectId: subject.id, code: s.code } },
      update: { title: s.title, level: s.level, examWeight: s.examWeight ?? null, sortOrder: s.sortOrder ?? 0, source: data.source ?? null },
      create: { subjectId: subject.id, code: s.code, title: s.title, level: s.level, examWeight: s.examWeight ?? null, sortOrder: s.sortOrder ?? 0, source: data.source ?? null },
    })
  }

  // Pass 2 — resolve parentCode -> parentId now that all rows exist.
  const all = await prisma.topic.findMany({ where: { subjectId: subject.id }, select: { id: true, code: true } })
  const idByCode = new Map(all.map((t) => [t.code, t.id]))
  let linked = 0, orphaned = 0
  for (const s of data.strands) {
    const parentId = s.parentCode ? idByCode.get(s.parentCode) ?? null : null
    if (s.parentCode && !parentId) orphaned++
    await prisma.topic.update({
      where: { subjectId_code: { subjectId: subject.id, code: s.code } },
      data: { parentId },
    })
    if (parentId) linked++
  }

  console.log(`✓ Imported ${data.strands.length} topics into ${subject.curriculum.code} ${subject.name} (${linked} child links${orphaned ? `, ${orphaned} unresolved parents` : ""}).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
