/**
 * In-memory cosine similarity for RAG retrieval.
 * No external vector DB needed for demo scale (1 document, ~50 chunks max).
 */

/** Compute dot product of two vectors */
function dot(a: number[], b: number[]): number {
  return a.reduce((sum, val, i) => sum + val * (b[i] ?? 0), 0);
}

/** Compute L2 norm of a vector */
function norm(v: number[]): number {
  return Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
}

/** Cosine similarity between two vectors, returns value in [-1, 1] */
export function cosineSimilarity(a: number[], b: number[]): number {
  const normA = norm(a);
  const normB = norm(b);
  if (normA === 0 || normB === 0) return 0;
  return dot(a, b) / (normA * normB);
}

export interface ScoredChunk {
  chunkText: string;
  score: number;
  chunkIndex: number;
}

/**
 * Find top-K most relevant chunks by cosine similarity.
 * 
 * @param queryEmbedding - embedding of the user's question
 * @param chunks - all chunks with their embeddings
 * @param topK - number of chunks to return
 * @param minScore - minimum similarity threshold
 */
export function findTopChunks(
  queryEmbedding: number[],
  chunks: Array<{ chunkText: string; embedding: number[]; chunkIndex: number }>,
  topK = 3,
  minScore = 0.1
): ScoredChunk[] {
  const scored = chunks
    .map((chunk) => ({
      chunkText: chunk.chunkText,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
      chunkIndex: chunk.chunkIndex,
    }))
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}
