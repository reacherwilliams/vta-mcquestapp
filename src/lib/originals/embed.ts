import "server-only"
import type { FeatureExtractionPipeline } from "@huggingface/transformers"

// LOCAL, in-house embeddings via Transformers.js — the question text never leaves
// our infrastructure (important for the copyrighted originals). Runs in-process in
// both the offline ingestion script and the Vercel runtime.
//
// Model: all-MiniLM-L6-v2 → 384-dim, normalized. Must match the pgvector column
// dimension (vector(384)). Both originals and contributor questions are embedded
// with the SAME model so their vectors are comparable.
const MODEL = "Xenova/all-MiniLM-L6-v2"
export const EMBEDDING_DIM = 384

// Lazy singleton — the model is loaded once per process (first call is slower).
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null
function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = import("@huggingface/transformers").then((t) =>
      t.pipeline("feature-extraction", MODEL) as Promise<FeatureExtractionPipeline>,
    )
  }
  return extractorPromise
}

export async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor()
  const output = await extractor(text.slice(0, 8000), { pooling: "mean", normalize: true })
  return Array.from(output.data as Float32Array)
}
