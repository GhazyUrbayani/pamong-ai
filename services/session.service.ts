import { db } from '@/db/client';
import { sessions, students } from '@/db/schema';
import { sessionQueries } from '@/db/queries/sessions';
import { studentQueries } from '@/db/queries/students';
import { messageQueries, chunkQueries } from '@/db/queries/messages';
import { Session, Student, StudentCredential, GUARDIAN_CONSENT_STATEMENT } from '@/types';
import bcrypt from 'bcryptjs';

/**
 * Session Service — Responsible for:
 * 1. Creating class sessions
 * 2. Generating authentic student credentials automatically
 * 3. Computing session-level stats for dashboard
 */

// Realistic Indonesian student names
const INDONESIAN_STUDENTS = [
  { name: 'Ahmad Fauzi', username: 'ahmad.fauzi' },
  { name: 'Siti Nurhaliza', username: 'siti.nurhaliza' },
  { name: 'Budi Santoso', username: 'budi.santoso' },
  { name: 'Dewi Lestari', username: 'dewi.lestari' },
  { name: 'Rian Hidayat', username: 'rian.hidayat' },
  { name: 'Nabila Putri', username: 'nabila.putri' },
  { name: 'Dimas Anggara', username: 'dimas.anggara' },
  { name: 'Zahra Aulia', username: 'zahra.aulia' },
  { name: 'Kevin Sanjaya', username: 'kevin.sanjaya' },
  { name: 'Putri Maharani', username: 'putri.maharani' },
  { name: 'Rizky Ramadhan', username: 'rizky.ramadhan' },
  { name: 'Anisa Rahmawati', username: 'anisa.rahma' },
  { name: 'Fajar Nugraha', username: 'fajar.nugraha' },
  { name: 'Gita Gutawa', username: 'gita.gutawa' },
  { name: 'Hendra Setiawan', username: 'hendra.setiawan' },
  { name: 'Tiara Andini', username: 'tiara.andini' },
  { name: 'Farhan Maulana', username: 'farhan.m' },
  { name: 'Salma Salsabila', username: 'salma.salsabila' },
  { name: 'Yoga Pratama', username: 'yoga.pratama' },
  { name: 'Maya Safitri', username: 'maya.safitri' },
  { name: 'Rafi Ahmad', username: 'rafi.ahmad' },
  { name: 'Dinda Kirana', username: 'dinda.kirana' },
  { name: 'Bayu Samudra', username: 'bayu.samudra' },
  { name: 'Citra Kirana', username: 'citra.kirana' },
];

// bcrypt cost. Session creation hashes 20 passwords in one request, so this is a
// deliberate balance rather than the highest value that would still "work".
const BCRYPT_ROUNDS = 10;

// Unambiguous alphabet — no 0/O, no 1/l/I — so a printed credential slip cannot
// be misread by a student typing it on a phone.
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * Generate a random password for one student.
 *
 * This replaces a fixed pool of six shared passwords, under which a student could
 * guess a classmate's login in a handful of attempts and read or pollute their
 * transcript. The plaintext returned here is shown to the teacher once and then
 * discarded; only a bcrypt hash reaches the database.
 *
 * Rejection sampling avoids the modulo bias that a plain `% alphabet.length` would
 * introduce. These are credentials, so the distribution should be even.
 */
function generatePassword(length = 8): string {
  // Largest multiple of the alphabet size that fits in a byte. Bytes at or above
  // it are discarded rather than folded, which would favour earlier characters.
  const limit = Math.floor(256 / PASSWORD_ALPHABET.length) * PASSWORD_ALPHABET.length;

  let out = '';
  const buffer = new Uint8Array(length * 2);

  while (out.length < length) {
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (out.length === length) break;
      if (byte < limit) out += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
    }
  }

  // Grouped so it is easy to read aloud or copy from a printed list.
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

/**
 * Short per-session tag appended to every username in that session.
 *
 * `students.username` is globally unique in the schema, but the display-name pool
 * is fixed, so without this every session would generate the same usernames and
 * creating a second session would fail on the unique constraint.
 */
function generateSessionTag(length = 4): string {
  const limit = Math.floor(256 / PASSWORD_ALPHABET.length) * PASSWORD_ALPHABET.length;
  let out = '';
  const buffer = new Uint8Array(length * 2);

  while (out.length < length) {
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (out.length === length) break;
      if (byte < limit) out += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
    }
  }
  return out;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

export interface CreateSessionInput {
  teacherId: string;
  title: string;
  subject: string;
  aiTheme: string;
  maxStudents?: number;
  quotaPerStudent?: number;
  /** The teacher's attestation that guardian consent was obtained. Required. */
  guardianConsent: boolean;
}

export class SessionService {
  /**
   * Create a new session and generate all student credentials upfront.
   */
  async createSession(
    input: CreateSessionInput
  ): Promise<{ session: Session; students: Student[]; credentials: StudentCredential[] }> {
    const {
      teacherId,
      title,
      subject,
      aiTheme,
      maxStudents = 20,
      quotaPerStudent = 20,
      guardianConsent,
    } = input;

    // Enforced here rather than only in the route so no code path can create a
    // session that processes a child's data without a recorded attestation.
    if (!guardianConsent) {
      throw new Error('Persetujuan orang tua/wali wajib dikonfirmasi sebelum kelas dibuat.');
    }

    const sessionId = crypto.randomUUID();
    const now = Date.now();

    // Create session
    const session: Session = {
      id: sessionId,
      teacherId,
      title,
      subject,
      aiTheme,
      maxStudents,
      quotaPerStudent,
      status: 'active',
      createdAt: now,
      guardianConsentAt: now,
      guardianConsentStatement: GUARDIAN_CONSENT_STATEMENT,
    };

    await sessionQueries.insert(session);

    // Generate student credentials with authentic Indonesian student names
    const count = Math.min(maxStudents, INDONESIAN_STUDENTS.length);

    // The plaintext exists only here, on its way to the teacher. Only the hash is
    // written to the database.
    const buildStudents = (tag: string) => {
      const credentials: StudentCredential[] = [];

      const rows: Student[] = Array.from({ length: count }, (_, i) => {
        const template = INDONESIAN_STUDENTS[i % INDONESIAN_STUDENTS.length];
        const id = crypto.randomUUID();
        // Tagged per session: the name pool is fixed and usernames are globally
        // unique, so an untagged username collides with every earlier session.
        const username = `${template.username}.${tag}`;
        const password = generatePassword();

        credentials.push({ id, username, displayName: template.name, password });

        return {
          id,
          sessionId,
          username,
          passwordHash: bcrypt.hashSync(password, BCRYPT_ROUNDS),
          displayName: template.name,
          roomCode: null,
          createdAt: now,
        };
      });

      return { rows, credentials };
    };

    // A tag collision across sessions is unlikely but possible. insertMany is a
    // single statement, so a rejected batch inserts nothing and retrying with a
    // fresh tag is safe.
    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const { rows, credentials } = buildStudents(generateSessionTag());

      try {
        await studentQueries.insertMany(rows);
        return { session, students: rows, credentials };
      } catch (err) {
        if (!isUniqueViolation(err) || attempt === MAX_ATTEMPTS) throw err;
      }
    }

    // Unreachable: the loop either returns or throws.
    throw new Error('Gagal membuat kredensial siswa yang unik.');
  }

  /**
   * Get a session with its students.
   */
  async getSessionWithStudents(sessionId: string) {
    const session = await sessionQueries.getById(sessionId);
    if (!session) return null;

    const studentList = await studentQueries.getBySession(sessionId);
    return { session, students: studentList };
  }

  /**
   * Reset credentials for some or all students in a session.
   *
   * This is what replaces reading a stored password back. A teacher helping a
   * student who lost their slip issues a new password rather than retrieving the
   * old one, which is why nothing has to be recoverable.
   *
   * Returns the new plaintext once. Any device already signed in keeps its JWT
   * until it expires; the new password governs the next sign-in.
   */
  async resetCredentials(sessionId: string, studentIds?: string[]): Promise<StudentCredential[]> {
    const roster = await studentQueries.getBySession(sessionId);

    const targets = studentIds?.length
      ? roster.filter((s) => studentIds.includes(s.id))
      : roster;

    const credentials: StudentCredential[] = [];

    for (const student of targets) {
      const password = generatePassword();
      await studentQueries.updatePasswordHash(student.id, bcrypt.hashSync(password, BCRYPT_ROUNDS));
      credentials.push({
        id: student.id,
        username: student.username,
        displayName: student.displayName,
        password,
      });
    }

    return credentials;
  }

  /**
   * Permanently delete a session and everything attached to it.
   *
   * This is the erasure path UU PDP presumes a controller can perform: transcripts,
   * student records, the module's indexed chunks, and the session row itself. There
   * is no soft delete and nothing is recoverable afterwards.
   *
   * Children are removed before the parent because every child table carries a
   * foreign key to `sessions.id`.
   */
  async deleteSession(sessionId: string): Promise<void> {
    await messageQueries.deleteBySession(sessionId);
    await chunkQueries.deleteBySession(sessionId);
    await studentQueries.deleteBySession(sessionId);
    await sessionQueries.deleteById(sessionId);
  }

  /**
   * Compute how many messages a student has used.
   */
  async getStudentMessageCount(studentId: string): Promise<number> {
    const result = await studentQueries.getMessageCount(studentId);
    return result?.count ?? 0;
  }
}

// Singleton
let _sessionService: SessionService | null = null;
export function getSessionService(): SessionService {
  if (!_sessionService) _sessionService = new SessionService();
  return _sessionService;
}
