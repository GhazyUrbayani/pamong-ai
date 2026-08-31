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
}

export interface Student {
  id: string;
  sessionId: string;
  username: string;
  passwordPlain: string;
  displayName: string;
  roomCode: string | null;
  createdAt: number;
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
}

export interface SessionWithStudents extends Session {
  students: Student[];
}
