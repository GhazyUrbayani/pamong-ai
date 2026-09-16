import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ─── Teachers ───────────────────────────────────────────────────────────────
export const teachers = sqliteTable('teachers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at').notNull(),
});

// ─── Sessions ────────────────────────────────────────────────────────────────
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  teacherId: text('teacher_id').notNull().references(() => teachers.id),
  title: text('title').notNull(),
  subject: text('subject').notNull(),
  aiTheme: text('ai_theme').notNull().default('umum'),
  maxStudents: integer('max_students').notNull().default(20),
  quotaPerStudent: integer('quota_per_student').notNull().default(20),
  status: text('status', { enum: ['active', 'closed'] }).notNull().default('active'),
  createdAt: integer('created_at').notNull(),
  // Guardian-consent record. UU PDP requires a controller to be able to demonstrate
  // that consent was obtained for a child's data — not merely to assert it. The
  // school collects the consent itself; these columns record who attested to it,
  // when, and to exactly which wording.
  guardianConsentAt: integer('guardian_consent_at'),
  guardianConsentStatement: text('guardian_consent_statement'),
});

// ─── Knowledge Chunks (RAG) ──────────────────────────────────────────────────
export const knowledgeChunks = sqliteTable('knowledge_chunks', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  chunkText: text('chunk_text').notNull(),
  // Stored as JSON string of float array
  embeddingJson: text('embedding_json').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
});

// ─── Students ────────────────────────────────────────────────────────────────
export const students = sqliteTable('students', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  username: text('username').notNull().unique(),
  // bcrypt hash. The plaintext is shown to the teacher once, at generation or
  // reset, and is never stored — see ARCHITECTURE.md §3.
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  roomCode: text('room_code'),
  createdAt: integer('created_at').notNull(),
});

// ─── Messages ────────────────────────────────────────────────────────────────
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  studentId: text('student_id').notNull().references(() => students.id),
  roomCode: text('room_code'),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  questionLevel: text('question_level', {
    enum: ['hafalan', 'pemahaman', 'analisis'],
  }),
  createdAt: integer('created_at').notNull(),
});
