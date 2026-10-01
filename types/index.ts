export type StoredQuestionCategory = 'hafalan' | 'pemahaman' | 'analisis';
export type QuestionCategory = StoredQuestionCategory | 'unclassified';
/** @deprecated Legacy name retained for storage compatibility. */
export type QuestionLevel = QuestionCategory;
export type ClassificationProvenance = 'model' | 'degraded' | 'malformed' | 'error' | 'not_run' | 'synthetic';
export interface ClassificationResult { questionCategory: QuestionCategory; provenance: ClassificationProvenance; }
export type AnswerProvenance = 'model' | 'demo' | 'unavailable' | 'application';
export type SessionStatus = 'active' | 'closed';
export type MessageRole = 'user' | 'assistant';

export interface Teacher { id: string; name: string; email: string; createdAt: number; }
export interface Session {
  id: string; teacherId: string; title: string; subject: string; aiTheme: string;
  maxStudents: number; quotaPerStudent: number; status: SessionStatus; createdAt: number;
  guardianConsentAt: number | null; guardianConsentStatement: string | null;
}
export const GUARDIAN_CONSENT_STATEMENT =
  'v1: Saya menyatakan bahwa sekolah telah memperoleh persetujuan orang tua/wali ' +
  'untuk setiap siswa di kelas ini, sesuai UU No. 27 Tahun 2022 tentang Pelindungan ' +
  'Data Pribadi, atas pemrosesan pertanyaan dan transkrip belajar mereka oleh Pamong AI.';
export interface Student { id:string; sessionId:string; username:string; passwordHash:string; displayName:string; roomCode:string|null; createdAt:number; }
export interface StudentCredential { id:string; username:string; displayName:string; password:string; }
export interface Message {
  id:string; sessionId:string; studentId:string; roomCode:string|null; role:MessageRole; content:string;
  questionLevel: QuestionCategory | null; classificationProvenance?: ClassificationProvenance | null; createdAt:number;
}
export interface KnowledgeChunk {
  id:string; sessionId:string; chunkText:string; embedding:number[]; chunkIndex:number;
  embeddingProvider?:string|null; embeddingModel?:string|null; embeddingDimensions?:number|null;
}
export interface StudentStats {
  id:string; username:string; displayName:string; chatUsed:number; quotaTotal:number;
  categories:{hafalan:number;pemahaman:number;analisis:number};
  unclassified:number; validClassified:number; totalQuestions:number;
}
export interface AITheme { name:string; fullName:string; avatar:string; primaryColor:string; accentColor:string; greeting:string; }
export interface TeacherJWT { sub:string; role:'teacher'; name:string; email:string; }
export interface StudentJWT { sub:string; role:'student'; username:string; sessionId:string; displayName:string; }
export interface ChatResponse {
  reply:string; questionLevel:QuestionCategory; classificationProvenance:ClassificationProvenance;
  quotaRemaining:number; sources:string[]; degraded:boolean; aiProvenance:AnswerProvenance;
}
export interface SessionWithStudents extends Session { students: Student[]; }
