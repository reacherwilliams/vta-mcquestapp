// ─── Source-note citation parsing ────────────────────────────────────────────
// Contributors cite their inspiration in the question's free-text `sourceNote`,
// e.g. "Inspired by 0625/22 Q5" or "0625/12 M/J 2021 Q14". This turns that prose
// into a structured reference so we can (a) show the contributor a recognized
// chip as they type and (b) look up THAT specific original to verify the
// "inspired by" claim against it — not just the subject-wide pool.
//
// Pure module (no server-only imports) — safe to use in the client editor.

export type ParsedCitation = {
  syllabusCode: string        // "0625"
  paper?: number              // 1..9 (first digit of the paper/variant pair)
  variant?: number            // 1..3 (second digit)
  session?: "FM" | "MJ" | "ON" // Feb/March | May/June | Oct/Nov
  year?: number               // 2021
  questionNumber?: number     // 14
  raw: string                 // the matched "0625/12 M/J 2021 Q14" slice
}

// Map the various ways people write the session onto our stored codes.
const SESSION_MAP: Record<string, ParsedCitation["session"]> = {
  "M/J": "MJ", "MJ": "MJ", "MAY/JUNE": "MJ", "MAYJUNE": "MJ", "SUMMER": "MJ",
  "O/N": "ON", "ON": "ON", "OCT/NOV": "ON", "OCTNOV": "ON", "WINTER": "ON",
  "F/M": "FM", "FM": "FM", "FEB/MARCH": "FM", "FEBMARCH": "FM",
}

/**
 * Parse a free-text source note into a structured CAIE-style citation.
 * Returns null when no syllabus/paper code (NNNN/PV) is present.
 */
export function parseCitation(note: string | null | undefined): ParsedCitation | null {
  if (!note) return null
  const text = note.trim()

  // Core anchor: 4-digit syllabus code + "/" + paper digit + optional variant
  // digit. e.g. "0625/22", "9701/4", "0610/31".
  const code = /\b(\d{4})\/(\d)(\d?)\b/.exec(text)
  if (!code) return null

  const [matched, syllabusCode, paperDigit, variantDigit] = code

  // Session: M/J, O/N, F/M (and spelled-out / collapsed variants).
  let session: ParsedCitation["session"]
  const sess = /\b(M\/J|O\/N|F\/M|MJ|ON|FM|May\/June|Oct\/Nov|Feb\/March)\b/i.exec(text)
  if (sess) session = SESSION_MAP[sess[1].toUpperCase()]

  // Year: a 19xx/20xx near the citation.
  let year: number | undefined
  const yr = /\b(19|20)\d{2}\b/.exec(text)
  if (yr) year = Number(yr[0])

  // Question number: "Q5", "Q 14", "Question 3".
  let questionNumber: number | undefined
  const qn = /\bQ(?:uestion)?\s*\.?\s*(\d{1,2})\b/i.exec(text)
  if (qn) questionNumber = Number(qn[1])

  return {
    syllabusCode,
    paper: Number(paperDigit),
    ...(variantDigit ? { variant: Number(variantDigit) } : {}),
    ...(session ? { session } : {}),
    ...(year ? { year } : {}),
    ...(questionNumber ? { questionNumber } : {}),
    raw: matched + (sess ? ` ${sess[1]}` : "") + (year ? ` ${year}` : "") + (questionNumber ? ` Q${questionNumber}` : ""),
  }
}

/** Compact human label for a parsed citation, e.g. "0625/22 · MJ 2021 · Q14". */
export function citationLabel(c: ParsedCitation): string {
  const code = `${c.syllabusCode}/${c.paper ?? ""}${c.variant ?? ""}`
  const when = [c.session, c.year].filter(Boolean).join(" ")
  const q = c.questionNumber != null ? `Q${c.questionNumber}` : ""
  return [code, when, q].filter(Boolean).join(" · ")
}
