import "server-only"
import { createHash } from "crypto"

// Normalize text so trivial differences (case, whitespace, punctuation) don't
// defeat exact-match detection, then hash it. A shared hash between a contributor
// question and an original = a verbatim copy. The hash is non-reversible.
export function normalizedHash(text: string): string {
  const norm = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ") // strip punctuation/symbols to spaces
    .replace(/\s+/g, " ")
    .trim()
  return createHash("sha256").update(norm).digest("hex")
}
