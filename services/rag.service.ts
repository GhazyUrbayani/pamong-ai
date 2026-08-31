import { getLLMService, LLMService } from './llm.service';
import { findTopChunks, ScoredChunk } from '@/lib/embedding';
import { extractTextFromFile } from '@/lib/pdf-parser';
import { chunkQueries } from '@/db/queries/messages';
import { KnowledgeChunk } from '@/types';

/**
 * RAG Service — Responsible for:
 * 1. Chunking uploaded documents
 * 2. Embedding chunks and persisting to DB
 * 3. Retrieving relevant chunks for a question
 */

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

export interface RetrievalResult {
  contextText: string;
  sources: string[];
}

export class RAGService {
  constructor(private llm: LLMService = getLLMService()) {}

  /**
   * Process an uploaded file: extract text, chunk it, embed all chunks, save to DB.
   * Returns the number of chunks created.
   */
  async processDocument(sessionId: string, file: Buffer, filename: string): Promise<number> {
    // 1. Extract raw text
    const rawText = await extractTextFromFile(file, filename);
    if (!rawText.trim()) throw new Error('Dokumen kosong atau tidak dapat dibaca.');

    // 2. Chunk the text
    const chunks = this.chunkText(rawText);
    if (chunks.length === 0) throw new Error('Tidak ada konten yang dapat diekstrak.');

    // 3. Embed all chunks in batch
    const embeddings = await this.llm.embedBatch(chunks);

    // 4. Delete old chunks for this session (re-upload replaces old knowledge)
    await chunkQueries.deleteBySession(sessionId);

    // 5. Save new chunks to DB
    const rows = chunks.map((chunk, i) => ({
      id: crypto.randomUUID(),
      sessionId,
      chunkText: chunk,
      embeddingJson: JSON.stringify(embeddings[i] ?? []),
      chunkIndex: i,
    }));

    await chunkQueries.insertMany(rows);

    return rows.length;
  }

  /**
   * Retrieve top-K relevant chunks for a query from the session's knowledge base.
   */
  async retrieve(sessionId: string, query: string, topK = 3): Promise<RetrievalResult> {
    // 1. Get all chunks for this session from DB
    const dbChunks = await chunkQueries.getBySession(sessionId);

    if (dbChunks.length === 0) {
      return {
        contextText: '',
        sources: [],
      };
    }

    // 2. Parse embeddings from stored JSON
    const chunksWithEmbeddings = dbChunks.map((c) => ({
      chunkText: c.chunkText,
      embedding: JSON.parse(c.embeddingJson) as number[],
      chunkIndex: c.chunkIndex,
    }));

    // 3. Embed the query
    const queryEmbedding = await this.llm.embed(query);

    // 4. Find top-K by cosine similarity
    const topChunks = findTopChunks(queryEmbedding, chunksWithEmbeddings, topK);

    if (topChunks.length === 0) {
      return { contextText: '', sources: [] };
    }

    // 5. Format context block (ordered by chunk index for coherence)
    const orderedChunks = topChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
    const contextText = orderedChunks.map((c) => c.chunkText).join('\n\n---\n\n');
    const sources = orderedChunks.map(
      (c, i) => `[${i + 1}] Bagian ${c.chunkIndex + 1} dokumen (relevansi: ${(c.score * 100).toFixed(0)}%)`
    );

    return { contextText, sources };
  }

  /**
   * Split text into overlapping chunks.
   * Simple character-based chunking (sufficient for MVP).
   */
  private chunkText(text: string): string[] {
    // Normalize whitespace
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return [];

    const chunks: string[] = [];
    const step = Math.max(1, CHUNK_SIZE - CHUNK_OVERLAP);

    for (let start = 0; start < normalized.length; start += step) {
      const end = Math.min(start + CHUNK_SIZE, normalized.length);
      const chunk = normalized.slice(start, end).trim();
      if (chunk.length > 20) {
        chunks.push(chunk);
      }
      if (end >= normalized.length) break;
    }

    return chunks;
  }
}

// Singleton
let _ragService: RAGService | null = null;
export function getRAGService(): RAGService {
  if (!_ragService) _ragService = new RAGService();
  return _ragService;
}
