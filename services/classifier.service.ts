import { getLLMService, LLMService } from './llm.service';
import { QuestionLevel } from '@/types';

/**
 * Classifier Service — Single Responsibility: classify student questions into cognitive levels.
 *
 * Bloom's Taxonomy adaptation for Indonesian school context:
 * - hafalan    : Recall / Define / List (Level 1-2)
 * - pemahaman  : Explain / Describe / Compare (Level 3-4)
 * - analisis   : Apply / Analyze / Evaluate / Create (Level 5-6)
 *
 * This is intentionally a SEPARATE service, NOT inline in chat handler.
 * It can be mocked independently in unit tests.
 */

const CLASSIFIER_SYSTEM_PROMPT = `Kamu adalah classifier pendidikan. Tugasmu HANYA mengklasifikasi pertanyaan siswa ke dalam satu dari 3 level kognitif berdasarkan Taksonomi Bloom yang diadaptasi:

1. "hafalan" — Siswa menghafal, mendefinisikan, menyebut, atau mencari fakta dasar. Contoh: "Apa itu fotosintesis?", "Sebutkan 3 jenis...", "Kapan terjadi...?"
2. "pemahaman" — Siswa menjelaskan, membandingkan, merangkum, atau mendeskripsikan proses/konsep. Contoh: "Bagaimana proses fotosintesis bekerja?", "Apa perbedaan antara X dan Y?", "Mengapa hal ini terjadi?"
3. "analisis" — Siswa mengaplikasikan, menganalisis, mengevaluasi, atau menciptakan sesuatu dari konsep. Contoh: "Apa yang terjadi jika...", "Bagaimana cara menggunakan konsep ini untuk...", "Evaluasi mengapa..."

ATURAN KETAT:
- Balas HANYA dengan satu kata: hafalan, pemahaman, atau analisis
- JANGAN tambahkan penjelasan, titik, atau karakter lain
- Jika ragu, pilih level yang lebih rendah`;

export class ClassifierService {
  constructor(private llm: LLMService = getLLMService()) {}

  /**
   * Classify a student's question into a cognitive level.
   * Makes a separate, lightweight LLM call.
   * Returns 'hafalan' as safe default if classification fails.
   */
  async classify(question: string): Promise<QuestionLevel> {
    try {
      const response = await this.llm.chat(
        [
          { role: 'system', content: CLASSIFIER_SYSTEM_PROMPT },
          { role: 'user', content: question },
        ],
        {
          temperature: 0, // Deterministic classification
          maxTokens: 10,  // Only need one word
        }
      );

      const raw = response.trim().toLowerCase();

      if (raw === 'hafalan' || raw === 'pemahaman' || raw === 'analisis') {
        return raw;
      }

      // Fuzzy match in case model returns extra chars
      if (raw.includes('analisis')) return 'analisis';
      if (raw.includes('pemahaman')) return 'pemahaman';
      return 'hafalan';
    } catch (error) {
      console.error('[classifier] Classification failed, defaulting to hafalan:', error);
      return 'hafalan';
    }
  }
}

// Singleton
let _classifierService: ClassifierService | null = null;
export function getClassifierService(): ClassifierService {
  if (!_classifierService) _classifierService = new ClassifierService();
  return _classifierService;
}
