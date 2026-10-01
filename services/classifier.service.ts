import { getLLMService, LLMService } from './llm.service';
import { ClassificationResult, ClassificationProvenance, QuestionCategory } from '@/types';
import { QUESTION_CATEGORY_RUBRIC, classifyWithProvider } from '@/lib/mvp-policy';

const CLASSIFIER_SYSTEM_PROMPT = `Kamu adalah pengklasifikasi bentuk pertanyaan siswa.
Pilih SATU key berdasarkan permintaan yang tampak pada pertanyaan, bukan kemampuan siswa:
1. "hafalan" — ${QUESTION_CATEGORY_RUBRIC.hafalan.description}
2. "pemahaman" — ${QUESTION_CATEGORY_RUBRIC.pemahaman.description}
3. "analisis" — ${QUESTION_CATEGORY_RUBRIC.analisis.description}
Balas HANYA satu key persis: hafalan, pemahaman, atau analisis.
Jangan menyimpulkan tingkat kemampuan, capaian belajar, atau Taksonomi Bloom siswa.`;

export class ClassifierService {
  constructor(private llm: LLMService = getLLMService()) {}
  async classify(question: string): Promise<ClassificationResult> {
    const resolved = await classifyWithProvider(() =>
      this.llm.chatWithMeta([
        { role:'system', content:CLASSIFIER_SYSTEM_PROMPT },
        { role:'user', content:question },
      ], { temperature:0, maxTokens:10 })
    );
    return {
      questionCategory: resolved.category as QuestionCategory,
      provenance: resolved.provenance as ClassificationProvenance,
    };
  }
}
let _classifierService: ClassifierService | null = null;
export function getClassifierService(): ClassifierService {
  if (!_classifierService) _classifierService=new ClassifierService();
  return _classifierService;
}
