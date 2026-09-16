// Types shared across the entire application

export type QuestionLevel = 'hafalan' | 'pemahaman' | 'analisis';
export type SessionStatus = 'active' | 'closed';
export type MessageRole = 'user' | 'assistant';

export interface Teacher {
  id: string;
  name: string;
  email: string;
  createdAt: number;
}

export interface Session {
  id: string;
  teacherId: string;
  title: string;
  subject: string;
  aiTheme: string;
  maxStudents: number;
  quotaPerStudent: number;
  status: SessionStatus;
  createdAt: number;
  /** When the teacher attested that guardian consent was obtained. */
  guardianConsentAt: number | null;
  /** The exact wording attested to, stored so the record is auditable. */
  guardianConsentStatement: string | null;
}

/**
 * The attestation a teacher must make before a class session can exist.
 * Versioned: changing the wording must not silently reinterpret past records.
 */
export const GUARDIAN_CONSENT_STATEMENT =
  'v1: Saya menyatakan bahwa sekolah telah memperoleh persetujuan orang tua/wali ' +
  'untuk setiap siswa di kelas ini, sesuai UU No. 27 Tahun 2022 tentang Pelindungan ' +
  'Data Pribadi, atas pemrosesan pertanyaan dan transkrip belajar mereka oleh Pamong AI.';

export interface Student {
  id: string;
  sessionId: string;
  username: string;
  passwordHash: string;
  displayName: string;
  roomCode: string | null;
  createdAt: number;
}

/**
 * A credential at the one moment it exists in plaintext: immediately after
 * generation or reset, on its way to the teacher. Never persisted, never returned
 * by a read endpoint.
 */
export interface StudentCredential {
  id: string;
  username: string;
  displayName: string;
  password: string;
}

export interface Message {
  id: string;
  sessionId: string;
  studentId: string;
  roomCode: string | null;
  role: MessageRole;
  content: string;
  questionLevel: QuestionLevel | null;
  createdAt: number;
}

export interface KnowledgeChunk {
  id: string;
  sessionId: string;
  chunkText: string;
  embedding: number[];
  chunkIndex: number;
}

// Dashboard stats per student
export interface StudentStats {
  id: string;
  username: string;
  displayName: string;
  chatUsed: number;
  quotaTotal: number;
  levels: {
    hafalan: number;
    pemahaman: number;
    analisis: number;
  };
  status: 'merah' | 'hijau' | 'netral';
}

// AI Theme config shape
export interface AITheme {
  name: string;
  fullName: string;
  avatar: string;
  primaryColor: string;
  accentColor: string;
  greeting: string;
}

// JWT Payload shapes
export interface TeacherJWT {
  sub: string;
  role: 'teacher';
  name: string;
  email: string;
}

export interface StudentJWT {
  sub: string;
  role: 'student';
  username: string;
  sessionId: string;
  displayName: string;
}

// API Response shapes
export interface ChatResponse {
  reply: string;
  questionLevel: QuestionLevel;
  quotaRemaining: number;
  sources: string[];
  /**
   * True when `reply` came from the offline heuristic stub instead of a model
   * (no API key configured, or the provider call failed). The UI must label such
   * replies — they are not grounded in the teacher's module.
   */
  degraded: boolean;
}

export interface SessionWithStudents extends Session {
  students: Student[];
}
