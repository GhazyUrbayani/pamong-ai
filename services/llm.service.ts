import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

/**
 * LLM Service — Injectable wrapper supporting Google Gemini (native via @google/genai),
 * OpenAI-compatible APIs, and graceful offline heuristic fallback.
 *
 * Design: thin wrapper that can be mocked in tests by injecting a custom client.
 * All LLM calls go through this service, never directly in route handlers.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMService {
  chat(messages: LLMMessage[], options?: ChatOptions): Promise<string>;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

/** Implementation for Google Gemini using official @google/genai SDK */
export class GeminiLLMService implements LLMService {
  private ai: GoogleGenAI;
  private model: string;
  private embeddingModel: string;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey =
      apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      '';
    this.ai = new GoogleGenAI({ apiKey: this.apiKey || 'dummy-key-for-build' });
    this.model = process.env.GEMINI_MODEL || 'gemini-3.7-flash';
    this.embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
  }

  private hasValidKey(): boolean {
    return Boolean(
      this.apiKey &&
      this.apiKey.trim() !== '' &&
      !this.apiKey.startsWith('sk-...') &&
      !this.apiKey.startsWith('YOUR_') &&
      this.apiKey !== 'dummy-key-for-build'
    );
  }

  async chat(messages: LLMMessage[], options: ChatOptions = {}): Promise<string> {
    if (!this.hasValidKey()) {
      return this.mockChat(messages);
    }

    try {
      const systemMessage = messages.find((m) => m.role === 'system');
      const nonSystemMessages = messages.filter((m) => m.role !== 'system');

      const contents = nonSystemMessages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Halo' }] }],
        config: {
          systemInstruction: systemMessage ? systemMessage.content : undefined,
          temperature: options.temperature ?? 0.3,
          maxOutputTokens: options.maxTokens ?? 1000,
        },
      });

      return response.text ?? '';
    } catch (err: any) {
      console.warn('[Gemini LLM] API call failed, falling back to local heuristic response:', err.message);
      return this.mockChat(messages);
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.hasValidKey()) {
      return this.mockEmbed(text);
    }

    try {
      const response = await this.ai.models.embedContent({
        model: this.embeddingModel,
        contents: text.slice(0, 8000),
      });

      const embedding = response.embeddings?.[0]?.values;
      if (embedding && embedding.length > 0) {
        return embedding;
      }
      return this.mockEmbed(text);
    } catch (err: any) {
      console.warn('[Gemini Embedding] API call failed, using heuristic embedding:', err.message);
      return this.mockEmbed(text);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.hasValidKey()) {
      return texts.map((t) => this.mockEmbed(t));
    }

    try {
      const BATCH_SIZE = 50;
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE).map((t) => t.slice(0, 8000));
        const response = await this.ai.models.embedContent({
          model: this.embeddingModel,
          contents: batch,
        });

        if (response.embeddings && response.embeddings.length > 0) {
          for (const item of response.embeddings) {
            results.push(item.values ?? this.mockEmbed(''));
          }
        } else {
          results.push(...batch.map((t) => this.mockEmbed(t)));
        }
      }

      return results;
    } catch (err: any) {
      console.warn('[Gemini Batch Embedding] API call failed, using heuristic embeddings:', err.message);
      return texts.map((t) => this.mockEmbed(t));
    }
  }

  // --- Offline Mock Helpers (Heuristic for Demo Reliability) ---

  private mockChat(messages: LLMMessage[]): string {
    const lastMsg = messages[messages.length - 1]?.content || '';
    const lower = lastMsg.toLowerCase();
    const systemPrompt = messages.find((m) => m.role === 'system')?.content || '';

    // Check if classifier call
    if (systemPrompt.includes('Taksonomi Bloom') || systemPrompt.includes('hafalan')) {
      if (
        lower.includes('mengapa') ||
        lower.includes('kenapa') ||
        lower.includes('bagaimana proses') ||
        lower.includes('jelaskan')
      ) {
        return 'pemahaman';
      }
      if (
        lower.includes('analisis') ||
        lower.includes('jika') ||
        lower.includes('dampak') ||
        lower.includes('evaluasi') ||
        lower.includes('bandingkan')
      ) {
        return 'analisis';
      }
      return 'hafalan';
    }

    // Standard RAG reply simulation based on context
    if (lower.includes('fotosintesis') || lower.includes('klorofil') || lower.includes('cahaya')) {
      return `Berdasarkan modul materi kita, fotosintesis adalah proses pembentukan zat makanan (glukosa) dari air (H2O) dan karbondioksida (CO2) dengan bantuan energi cahaya matahari yang diserap oleh klorofil pada daun. 🌿\n\nReaksi umumnya:\n6 CO2 + 6 H2O + Cahaya ➔ C6H12O6 + 6 O2\n\nApakah ada bagian dari reaksi terang atau reaksi gelap yang ingin kamu telusuri lebih dalam?`;
    }

    return `Berdasarkan materi yang dipelajari: "${lastMsg.slice(0, 80)}..." adalah konsep penting. Informasi ini saling terkait dengan konsep utama dalam modul kelas kita. Coba telusuri lebih dalam faktor-faktor yang memengaruhinya! 📚`;
  }

  private mockEmbed(text: string): number[] {
    // 64-dimensional pseudo-embedding from character hash distribution
    const vec = new Array(64).fill(0);
    const words = text.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const idx = (word.charCodeAt(j) * (j + 1) + i) % 64;
        vec[idx] += 1;
      }
    }
    // Normalize vector
    const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / mag);
  }
}

/** Fallback implementation using OpenAI SDK */
export class OpenAILLMService implements LLMService {
  private client: OpenAI;
  private model: string;
  private embeddingModel: string;
  private apiKey: string;

  constructor(client?: OpenAI) {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.client =
      client ??
      new OpenAI({
        apiKey: this.apiKey || 'dummy-key-for-build',
        baseURL: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      });
    this.model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    this.embeddingModel = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
  }

  private hasValidKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim() !== '' && !this.apiKey.startsWith('sk-...'));
  }

  async chat(messages: LLMMessage[], options: ChatOptions = {}): Promise<string> {
    if (!this.hasValidKey()) {
      return this.mockChat(messages);
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 1000,
      });

      return response.choices[0]?.message?.content ?? '';
    } catch (err: any) {
      console.warn('[OpenAI LLM] API call failed, falling back to local heuristic response:', err.message);
      return this.mockChat(messages);
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.hasValidKey()) {
      return this.mockEmbed(text);
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: text.slice(0, 8000),
      });
      return response.data[0]?.embedding ?? this.mockEmbed(text);
    } catch (err) {
      console.warn('[OpenAI Embedding] API call failed, using heuristic embedding');
      return this.mockEmbed(text);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.hasValidKey()) {
      return texts.map((t) => this.mockEmbed(t));
    }

    try {
      const BATCH_SIZE = 100;
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE).map((t) => t.slice(0, 8000));
        const response = await this.client.embeddings.create({
          model: this.embeddingModel,
          input: batch,
        });
        results.push(...response.data.map((d) => d.embedding));
      }

      return results;
    } catch (err) {
      console.warn('[OpenAI Embedding Batch] Failed, using heuristic embeddings');
      return texts.map((t) => this.mockEmbed(t));
    }
  }

  private mockChat(messages: LLMMessage[]): string {
    const lastMsg = messages[messages.length - 1]?.content || '';
    const lower = lastMsg.toLowerCase();
    const systemPrompt = messages.find((m) => m.role === 'system')?.content || '';

    if (systemPrompt.includes('Taksonomi Bloom') || systemPrompt.includes('hafalan')) {
      if (
        lower.includes('mengapa') ||
        lower.includes('kenapa') ||
        lower.includes('bagaimana proses') ||
        lower.includes('jelaskan')
      ) {
        return 'pemahaman';
      }
      if (
        lower.includes('analisis') ||
        lower.includes('jika') ||
        lower.includes('dampak') ||
        lower.includes('evaluasi') ||
        lower.includes('bandingkan')
      ) {
        return 'analisis';
      }
      return 'hafalan';
    }

    if (lower.includes('fotosintesis') || lower.includes('klorofil') || lower.includes('cahaya')) {
      return `Berdasarkan modul materi kita, fotosintesis adalah proses pembentukan zat makanan (glukosa) dari air (H2O) dan karbondioksida (CO2) dengan bantuan energi cahaya matahari yang diserap oleh klorofil pada daun. 🌿\n\nReaksi umumnya:\n6 CO2 + 6 H2O + Cahaya ➔ C6H12O6 + 6 O2\n\nApakah ada bagian dari reaksi terang atau reaksi gelap yang ingin kamu telusuri lebih dalam?`;
    }

    return `Berdasarkan materi yang dipelajari: "${lastMsg.slice(0, 80)}..." adalah konsep penting. Coba telusuri lebih dalam faktor-faktor yang memengaruhinya! 📚`;
  }

  private mockEmbed(text: string): number[] {
    const vec = new Array(64).fill(0);
    const words = text.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const idx = (word.charCodeAt(j) * (j + 1) + i) % 64;
        vec[idx] += 1;
      }
    }
    const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / mag);
  }
}

/** Singleton for production use */
let _llmService: LLMService | null = null;

export function getLLMService(): LLMService {
  if (!_llmService) {
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('sk-...'));

    if (hasOpenAIKey && !hasGeminiKey) {
      _llmService = new OpenAILLMService();
    } else {
      // Default to Gemini
      _llmService = new GeminiLLMService();
    }
  }
  return _llmService;
}

/** Override for testing */
export function setLLMService(service: LLMService) {
  _llmService = service;
}
