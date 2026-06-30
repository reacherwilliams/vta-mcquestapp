// ─── Structured tags ─────────────────────────────────────────────────────────
// The syllabus Topic tree now owns "what area" (Question.topicId), so free-text
// tags pivot to the orthogonal facets that AREN'T in the tree: paper number,
// command word, and skill type.
//
// We keep Question.tags as a free JSON string[] (no migration) but namespace the
// structured facets with a "key:value" prefix so they round-trip cleanly and
// power faceted filtering + exam-mode presets. Anything without a known prefix
// stays a plain free-text tag — so legacy tags ("kinematics", "May/June") and
// hand-typed extras are preserved untouched.

export const TAG_NS = { paper: "paper", command: "cmd", skill: "skill" } as const

export const PAPER_OPTIONS = [1, 2, 3, 4, 5, 6] as const

// CAIE/AP-style command words — the verb that frames what the question asks for.
export const COMMAND_WORDS = [
  "define", "state", "describe", "explain", "calculate",
  "determine", "suggest", "compare", "predict", "deduce",
] as const

// What cognitive skill the question exercises (independent of topic).
export const SKILL_TYPES = [
  "recall", "application", "graph-reading", "data-analysis",
  "problem-solving", "experimental",
] as const

export type StructuredTags = {
  paper: number | null
  command: string
  skills: string[]
  free: string[]
}

const PAPER_PREFIX = `${TAG_NS.paper}:`
const CMD_PREFIX = `${TAG_NS.command}:`
const SKILL_PREFIX = `${TAG_NS.skill}:`

/** Parse a flat tag array into the structured facets + leftover free tags. */
export function splitTags(tags: string[]): StructuredTags {
  let paper: number | null = null
  let command = ""
  const skills: string[] = []
  const free: string[] = []

  for (const raw of tags) {
    const tag = raw.trim()
    if (!tag) continue
    if (tag.startsWith(PAPER_PREFIX)) {
      const n = Number(tag.slice(PAPER_PREFIX.length))
      if (Number.isFinite(n)) paper = n
    } else if (tag.startsWith(CMD_PREFIX)) {
      command = tag.slice(CMD_PREFIX.length)
    } else if (tag.startsWith(SKILL_PREFIX)) {
      const s = tag.slice(SKILL_PREFIX.length)
      if (s && !skills.includes(s)) skills.push(s)
    } else {
      free.push(tag)
    }
  }
  return { paper, command, skills, free }
}

/** Serialize the structured facets + free tags back into a flat tag array. */
export function joinTags({ paper, command, skills, free }: StructuredTags): string[] {
  const out: string[] = []
  if (paper != null) out.push(`${PAPER_PREFIX}${paper}`)
  if (command) out.push(`${CMD_PREFIX}${command}`)
  for (const s of skills) out.push(`${SKILL_PREFIX}${s}`)
  for (const f of free) {
    const t = f.trim()
    if (t) out.push(t)
  }
  return out
}

/** Human label for a stored tag — used for chips in filters / cards. */
export function tagLabel(tag: string): string {
  if (tag.startsWith(PAPER_PREFIX)) return `Paper ${tag.slice(PAPER_PREFIX.length)}`
  if (tag.startsWith(CMD_PREFIX)) return cap(tag.slice(CMD_PREFIX.length))
  if (tag.startsWith(SKILL_PREFIX)) return tag.slice(SKILL_PREFIX.length)
  return tag
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}
