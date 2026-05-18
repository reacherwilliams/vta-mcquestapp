// Polymorphic content blocks for question stems, options, and explanations.
//
// Every renderable piece of a question is a ContentBlock so the same code
// path handles text, math, image, graph, and mixed cases. The renderer
// dispatches on `kind` — see src/components/questions/content-block.tsx.
//
// The image-option problem (where the answer choices themselves are
// images/graphs) is solved by letting `OptionContent` be any of these
// kinds, not just text.

import { z } from "zod"

// Text — plain prose. May contain inline markdown for emphasis only.
export const textBlockSchema = z.object({
  kind: z.literal("text"),
  text: z.string().min(1),
})

// Math — LaTeX rendered with KaTeX. `display` controls inline vs block.
export const mathBlockSchema = z.object({
  kind: z.literal("math"),
  latex: z.string().min(1),
  display: z.boolean().default(false),
})

// Image — any raster (PNG/JPEG/WebP). Stored on R2.
export const imageBlockSchema = z.object({
  kind: z.literal("image"),
  url: z.string().url(),
  alt: z.string().min(1),
  caption: z.string().optional(),
  // Hints the renderer for layout choices (e.g. 2x2 grid for options).
  aspect: z.enum(["square", "wide", "tall"]).default("square"),
})

// Graph — semantically distinct from Image so we can filter "show me only
// MCQs with graph options" and treat them differently in mobile layouts.
// Same payload as Image, just a different kind.
export const graphBlockSchema = z.object({
  kind: z.literal("graph"),
  url: z.string().url(),
  alt: z.string().min(1),
  caption: z.string().optional(),
  // SVG is preferred for graphs (small, infinite zoom). format hints the
  // renderer whether to enable pinch-to-zoom.
  format: z.enum(["svg", "raster"]).default("svg"),
})

// Mixed — a vertical stack of other blocks. Used for option cards that
// pair a label with an image, or stems that interleave prose + math + image.
export const mixedBlockSchema: z.ZodType<MixedBlock> = z.lazy(() =>
  z.object({
    kind: z.literal("mixed"),
    blocks: z.array(contentBlockSchema).min(1),
  }),
)

export const contentBlockSchema = z.union([
  textBlockSchema,
  mathBlockSchema,
  imageBlockSchema,
  graphBlockSchema,
  mixedBlockSchema,
])

export type TextBlock = z.infer<typeof textBlockSchema>
export type MathBlock = z.infer<typeof mathBlockSchema>
export type ImageBlock = z.infer<typeof imageBlockSchema>
export type GraphBlock = z.infer<typeof graphBlockSchema>
export type MixedBlock = { kind: "mixed"; blocks: ContentBlock[] }
export type ContentBlock = TextBlock | MathBlock | ImageBlock | GraphBlock | MixedBlock

// Stem and explanation are arrays of blocks; an option is a single block
// (which can itself be a Mixed block when you need a labelled image).
export const questionStemSchema = z.array(contentBlockSchema).min(1)
export const explanationSchema = z.array(contentBlockSchema).min(0)
export const optionContentSchema = contentBlockSchema

export type QuestionStem = ContentBlock[]
export type Explanation = ContentBlock[]
export type OptionContent = ContentBlock
