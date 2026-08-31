import { sqlite } from './client';
import { teachers, sessions, students, messages, knowledgeChunks } from './schema';
import bcrypt from 'bcryptjs';

/**
 * Run migrations: create all tables if they don't exist.
 * Called at app startup via middleware or layout.
 */
export function runMigrations() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES teachers(id),
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      ai_theme TEXT NOT NULL DEFAULT 'umum',
      max_students INTEGER NOT NULL DEFAULT 20,
      quota_per_student INTEGER NOT NULL DEFAULT 20,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      chunk_text TEXT NOT NULL,
      embedding_json TEXT NOT NULL,
      chunk_index INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      username TEXT NOT NULL UNIQUE,
      password_plain TEXT NOT NULL,
      display_name TEXT NOT NULL,
      room_code TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      student_id TEXT NOT NULL REFERENCES students(id),
      room_code TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      question_level TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_student ON messages(student_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_session ON knowledge_chunks(session_id);
    CREATE INDEX IF NOT EXISTS idx_students_session ON students(session_id);
  `);
}

/**
 * Seed default teacher account for demo.
 * Only creates if it doesn't exist yet.
 */
export async function seedTeacher() {
  const email = process.env.SEED_TEACHER_EMAIL ?? 'guru@pamong-ai.id';
  const password = process.env.SEED_TEACHER_PASSWORD ?? 'demo1234';
  const name = process.env.SEED_TEACHER_NAME ?? 'Ibu Sari';

  const existing = sqlite.prepare('SELECT id FROM teachers WHERE email = ?').get(email);
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 10);
  const id = crypto.randomUUID();
  const now = Date.now();

  sqlite.prepare(
    'INSERT INTO teachers (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, email, passwordHash, now);

  console.log(`[seed] Teacher created: ${email} / ${password}`);
}
