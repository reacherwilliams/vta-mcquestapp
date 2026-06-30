import "server-only"

// Flatten rich question content (text / math-latex / image-alt / nested mixed)
// into a single comparison string for embedding.
type Block = {
  kind?: string; type?: string
  text?: string; latex?: string; alt?: string; caption?: string
  blocks?: unknown[]
}

function blockText(b: unknown): string {
  if (!b || typeof b !== "object") return ""
  const block = b as Block
  const parts: string[] = []
  if (block.text) parts.push(block.text)
  if (block.latex) parts.push(block.latex)
  if (block.alt) parts.push(block.alt)
  if (block.caption) parts.push(block.caption)
  if (Array.isArray(block.blocks)) parts.push(block.blocks.map(blockText).join(" "))
  return parts.join(" ")
}

export function blocksToText(blocks: unknown): string {
  const raw = Array.isArray(blocks) ? blocks.map(blockText).join(" ") : blockText(blocks)
  return raw.replace(/\s+/g, " ").trim()
}

/** Flatten a contributor question (block-based stem + option contents) for embedding. */
export function questionToText(stem: unknown, options: { content: unknown }[]): string {
  const stemText = blocksToText(stem)
  const opts = options.map((o) => blocksToText(o.content)).filter(Boolean).join(" | ")
  return [stemText, opts].filter(Boolean).join("  ||  ").slice(0, 8000)
}

/** Flatten an original-bank question (plain stem string + [{label,text}] options). */
export function originalToText(stem: string, options: { text: string }[]): string {
  const opts = options.map((o) => o.text).filter(Boolean).join(" | ")
  return [stem, opts].filter(Boolean).join("  ||  ").replace(/\s+/g, " ").trim().slice(0, 8000)
}
