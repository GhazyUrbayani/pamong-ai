import { getLLMService, LLMService } from './llm.service';
import { getRAGService, RAGService } from './rag.service';
import { getClassifierService, ClassifierService } from './classifier.service';
import { messageQueries } from '@/db/queries/messages';
import { studentQueries } from '@/db/queries/students';
import { sessionQueries } from '@/db/queries/sessions';
import { ChatResponse, QuestionLevel, Message } from '@/types';
import aiThemes from '@/config/ai-themes.json';

/**
 * Chat Service — Orchestrator of the core AI chat flow.
 *
 * Responsibilities:
 * 1. Check quota (refuse if exceeded)
 * 2. Retrieve relevant context via RAG
 * 3. Classify the question level (parallel with RAG when possible)
 * 4. Build RAG-grounded prompt with anti-hallucination instructions
 * 5. Generate AI answer via LLM
 * 6. Persist both messages (user + assistant) to DB
 * 7. Return structured response with quota remaining
 */

const RAG_SYSTEM_PROMPT = `Kamu adalah asisten AI bernama {AI_FULL_NAME} untuk mata pelajaran {SUBJECT}.
Kamu adalah Guru & Tutor Pendamping yang ramah, sabar, dan menggunakan bahasa Indonesia yang santun, interaktif, dan mudah dimengerti siswa.

KONTEKS MATERI RESMI GURU (SUMBER TUNGGAL KEBENARAN):
---
{CONTEXT}
---
AKHIR KONTEKS

ATURAN WAJIB (ANTI-HALUSINASI & STRICT GROUNDING):
1. Kamu HANYA boleh menjawab berdasarkan KONTEKS MATERI di atas.
2. Jika pertanyaan TIDAK terdapat dalam konteks materi, jawab PERSIS: "Maaf, informasi ini belum tercantum dalam modul yang diunggah guru. Coba diskusikan langsung dengan gurumu ya! 😊"
3. DILARANG KERAS berasumsi atau menambahkan informasi di luar konteks resmi.

PEDOMAN LITERASI & TINGKAT KOGNITIF SISWA SAAT INI ({BLOOM_LEVEL_LABEL}):
{BLOOM_PEDAGOGICAL_INSTRUCTION}

FORMAT PENULISAN (RAMAH BACA SISWA):
- JANGAN menulis dinding teks (paragraf panjang tanpa jeda). Pecah menjadi kalimat-kalimat yang ringkas.
- Gunakan **huruf tebal** untuk istilah kunci agar mudah dipindai mata siswa.
- Gunakan poin-poin (-) jika menjelaskan langkah atau bagian.
- Gunakan emoji pendukung yang relevan secara wajar.`;

const NO_CONTEXT_PROMPT = `Kamu adalah asisten AI bernama {AI_FULL_NAME} untuk mata pelajaran {SUBJECT}.
Guru belum mengunggah materi modul untuk sesi ini.
Jawab PERSIS: "Maaf, guru belum mengunggah materi pelajaran untuk sesi kelas ini. Tunggu bapak/ibu guru mengunggah modul dulu ya! 📚"`;


export interface ChatInput {
  studentId: string;
  sessionId: string;
  message: string;
}

export class ChatService {
  constructor(
    private llm: LLMService = getLLMService(),
    private rag: RAGService = getRAGService(),
    private classifier: ClassifierService = getClassifierService()
  ) {}

  async chat(input: ChatInput): Promise<ChatResponse> {
    const { studentId, sessionId, message } = input;

    // 1. Fetch session info
    const session = await sessionQueries.getById(sessionId);
    if (!session) throw new Error('Sesi tidak ditemukan.');

    // 2. Check quota
    const msgCount = await studentQueries.getMessageCount(studentId);
    const used = msgCount?.count ?? 0;

    if (used >= session.quotaPerStudent) {
      return {
        reply: `Kamu sudah menggunakan ${used} dari ${session.quotaPerStudent} pesan untuk sesi ini. Terima kasih sudah belajar bersama! Minta guru untuk membuka sesi berikutnya ya. 🎉`,
        questionLevel: 'hafalan',
        quotaRemaining: 0,
        sources: [],
      };
    }

    // 3. Get AI theme config
    const theme = (aiThemes as Record<string, typeof aiThemes.umum>)[session.aiTheme]
      ?? aiThemes.umum;

    // 4. Run RAG retrieval and classification in parallel (faster)
    const [retrieval, questionLevel] = await Promise.all([
      this.rag.retrieve(sessionId, message),
      this.classifier.classify(message),
    ]);

    // 5. Build literacy & Bloom scaffolding instruction
    let bloomLabel = 'Tingkat Pemahaman (C3-C4)';
    let pedagogicalInstruction = '';

    if (questionLevel === 'hafalan') {
      bloomLabel = 'Tingkat Hafalan / Dasar (LOTS C1-C2)';
      pedagogicalInstruction = `
- Siswa menanyakan fakta dasar/definisi. Jawaban kamu WAJIB SINGKAT, PADAT, & RAMAH PEMULA (maksimal 2–3 kalimat pendek).
- Gunakan analogi atau perumpamaan nyata yang mudah dibayangkan siswa.
- HINDARI rumus/istilah biokimia rumit yang membuat siswa kewalahan (cognitive overload).
- Di akhir jawaban, sertakan TEPAT SATU (1) pertanyaan pemantik rasa ingin tahu yang ramah (contoh: "Nah, menurutmu kenapa ya tumbuhan butuh komponen ini? 😊") agar siswa terdorong memahami konsep.`;
    } else if (questionLevel === 'pemahaman') {
      bloomLabel = 'Tingkat Pemahaman Konseptual (MOTS C3-C4)';
      pedagogicalInstruction = `
- Siswa sedang mempelajari mekanisme/fungsi konsep.
- Sajikan jawaban secara terstruktur dengan poin-poin (-) yang rapi (maksimal 2-3 butir penjelasan).
- Jelaskan hubungan sebab-akibat dengan bahasa yang jelas dan to-the-point.
- Akhiri dengan 1 tantangan pengamatan sederhana untuk memperkuat pemahaman.`;
    } else {
      bloomLabel = 'Tingkat Analisis & Berpikir Kritis (HOTS C5-C6)';
      pedagogicalInstruction = `
- Siswa sedang berpikir tingkat tinggi (evaluasi kasus, perbandingan, atau pengujian hipotesis).
- Berikan ulasan analitis yang logis, bandingkan variabel/kondisi yang ditanyakan, dan validasi penalaran kritis siswa.
- Format jawaban rapi dengan paragraf-paragraf pendek dan ajak siswa mengevaluasi konsekuensinya.`;
    }

    // 6. Build system prompt
    let systemPrompt: string;
    if (retrieval.contextText) {
      systemPrompt = RAG_SYSTEM_PROMPT
        .replace('{AI_FULL_NAME}', theme.fullName)
        .replace('{SUBJECT}', session.subject)
        .replace('{CONTEXT}', retrieval.contextText)
        .replace('{BLOOM_LEVEL_LABEL}', bloomLabel)
        .replace('{BLOOM_PEDAGOGICAL_INSTRUCTION}', pedagogicalInstruction);
    } else {
      systemPrompt = NO_CONTEXT_PROMPT
        .replace('{AI_FULL_NAME}', theme.fullName)
        .replace('{SUBJECT}', session.subject);
    }


    // 6. Fetch recent chat history for context window (last 6 messages)
    const student = await studentQueries.getById(studentId);
    let recentHistory: Message[] = [];

    if (student?.roomCode) {
      recentHistory = await messageQueries.getByRoom(sessionId, student.roomCode);
    } else {
      recentHistory = await messageQueries.getBySoloStudent(studentId);
    }

    const historyMessages = recentHistory
      .slice(-6) // Last 6 messages for context
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // 7. Generate AI reply
    const reply = await this.llm.chat(
      [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: message },
      ],
      { temperature: 0.4, maxTokens: 800 }
    );

    const now = Date.now();

    // 8. Persist user message (with question level label)
    await messageQueries.insert({
      id: crypto.randomUUID(),
      sessionId,
      studentId,
      roomCode: student?.roomCode ?? null,
      role: 'user',
      content: message,
      questionLevel,
      createdAt: now,
    });

    // 9. Persist assistant reply
    await messageQueries.insert({
      id: crypto.randomUUID(),
      sessionId,
      studentId,
      roomCode: student?.roomCode ?? null,
      role: 'assistant',
      content: reply,
      questionLevel: null,
      createdAt: now + 1, // +1ms to preserve ordering
    });

    const quotaRemaining = Math.max(0, session.quotaPerStudent - used - 1);

    return {
      reply,
      questionLevel,
      quotaRemaining,
      sources: retrieval.sources,
    };
  }

  /**
   * Compute student dashboard stats from message history.
   */
  async computeStudentStats(sessionId: string) {
    const studentsData = await studentQueries.getBySession(sessionId);

    const session = await sessionQueries.getById(sessionId);
    if (!session) return [];

    const statsPromises = studentsData.map(async (student) => {
      const countResult = await studentQueries.getMessageCount(student.id);
      const chatUsed = countResult?.count ?? 0;

      const levelDist = await studentQueries.getLevelDistribution(student.id);
      const levels = { hafalan: 0, pemahaman: 0, analisis: 0 };
      for (const row of levelDist) {
        if (row.level) levels[row.level as QuestionLevel] = row.count;
      }

      const total = levels.hafalan + levels.pemahaman + levels.analisis;
      const halamanPct = total > 0 ? levels.hafalan / total : 0;
      const analisisPct = total > 0 ? levels.analisis / total : 0;

      // Status logic:
      // Merah: >70% hafalan AND no analisis (stuck at basic level)
      // Hijau: analisis > 30% (reaching higher levels)
      // Netral: in between or no messages
      let status: 'merah' | 'hijau' | 'netral' = 'netral';
      if (total >= 3) {
        if (analisisPct >= 0.3) status = 'hijau';
        else if (halamanPct >= 0.7 && analisisPct === 0) status = 'merah';
      }

      return {
        id: student.id,
        username: student.username,
        displayName: student.displayName,
        chatUsed,
        quotaTotal: session.quotaPerStudent,
        levels,
        status,
      };
    });

    return Promise.all(statsPromises);
  }
}

// Singleton
let _chatService: ChatService | null = null;
export function getChatService(): ChatService {
  if (!_chatService) _chatService = new ChatService();
  return _chatService;
}
