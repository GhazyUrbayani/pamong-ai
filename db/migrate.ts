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
      created_at INTEGER NOT NULL,
      guardian_consent_at INTEGER,
      guardian_consent_statement TEXT
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
      password_hash TEXT NOT NULL,
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

  migrateStudentPasswordsToHashes();
  addGuardianConsentColumns();
}

/**
 * Add the guardian-consent columns to a database created before they existed.
 * Nullable by design: sessions created earlier genuinely have no attestation, and
 * back-filling one would fabricate a consent record.
 */
function addGuardianConsentColumns() {
  const columns = (sqlite.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>)
    .map((c) => c.name);

  if (!columns.includes('guardian_consent_at')) {
    sqlite.exec('ALTER TABLE sessions ADD COLUMN guardian_consent_at INTEGER');
  }
  if (!columns.includes('guardian_consent_statement')) {
    sqlite.exec('ALTER TABLE sessions ADD COLUMN guardian_consent_statement TEXT');
  }
}

/**
 * Convert a pre-existing database that still stores student passwords in plaintext.
 *
 * Earlier versions kept `students.password_plain`. This hashes each value into a
 * new `password_hash` column and drops the plaintext, so upgrading an existing
 * deployment does not leave readable passwords behind. Idempotent: it does nothing
 * once the plaintext column is gone.
 */
function migrateStudentPasswordsToHashes() {
  const columns = sqlite.prepare('PRAGMA table_info(students)').all() as Array<{ name: string }>;
  const names = columns.map((c) => c.name);

  if (!names.includes('password_plain')) return;

  console.log('[migrate] Converting plaintext student passwords to bcrypt hashes...');

  if (!names.includes('password_hash')) {
    sqlite.exec("ALTER TABLE students ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''");
  }

  const rows = sqlite
    .prepare("SELECT id, password_plain FROM students WHERE password_hash = ''")
    .all() as Array<{ id: string; password_plain: string }>;

  const update = sqlite.prepare('UPDATE students SET password_hash = ? WHERE id = ?');
  for (const row of rows) {
    update.run(bcrypt.hashSync(row.password_plain, 10), row.id);
  }

  // SQLite 3.35+ supports DROP COLUMN. If the bundled build is older the plaintext
  // column survives; it is no longer read by any query, and the failure is loud.
  try {
    sqlite.exec('ALTER TABLE students DROP COLUMN password_plain');
  } catch (err) {
    console.warn(
      '[migrate] Could not drop students.password_plain — plaintext remains in the ' +
        'database file and should be removed manually:',
      err
    );
  }

  console.log(`[migrate] Converted ${rows.length} student password(s).`);
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
