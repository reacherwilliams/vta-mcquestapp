import "server-only"

// Semantic embeddings via OpenAI (no SDK — plain fetch to avoid an eager client).
// text-embedding-3-small → 1536 dims, matching the OriginalQuestion.embedding column.
const MODEL = "text-embedding-3-small"

export async function embed(text: string): Promise<number[]> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error("OPENAI_API_KEY is not set — required for similarity embeddings.")

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, input: text.slice(0, 8000) }),
  })
  if (!res.ok) {
    throw new Error(`Embedding API failed (${res.status}): ${await res.text().catch(() => "")}`)
  }
  const data = (await res.json()) as { data: { embedding: number[] }[] }
  const vec = data.data?.[0]?.embedding
  if (!vec) throw new Error("Embedding API returned no vector.")
  return vec
}
