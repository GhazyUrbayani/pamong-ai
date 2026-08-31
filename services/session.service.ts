import { db } from '@/db/client';
import { sessions, students } from '@/db/schema';
import { sessionQueries } from '@/db/queries/sessions';
import { studentQueries } from '@/db/queries/students';
import { Session, Student } from '@/types';

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

const PASSWORDS = ['belajar123', 'sinar456', 'pustaka789', 'cerdas2026', 'buku1234', 'pintar88'];

export interface CreateSessionInput {
  teacherId: string;
  title: string;
  subject: string;
  aiTheme: string;
  maxStudents?: number;
  quotaPerStudent?: number;
}

export class SessionService {
  /**
   * Create a new session and generate all student credentials upfront.
   */
  async createSession(input: CreateSessionInput): Promise<{ session: Session; students: Student[] }> {
    const {
      teacherId,
      title,
      subject,
      aiTheme,
      maxStudents = 20,
      quotaPerStudent = 20,
    } = input;

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
    };

    await sessionQueries.insert(session);

    // Generate student credentials with authentic Indonesian student names
    const count = Math.min(maxStudents, INDONESIAN_STUDENTS.length);
    const studentRows: Student[] = Array.from({ length: count }, (_, i) => {
      const template = INDONESIAN_STUDENTS[i % INDONESIAN_STUDENTS.length];
      const suffix = i >= INDONESIAN_STUDENTS.length ? `.${i + 1}` : '';
      const username = `${template.username}${suffix}`;
      const password = PASSWORDS[i % PASSWORDS.length];

      return {
        id: crypto.randomUUID(),
        sessionId,
        username,
        passwordPlain: password,
        displayName: template.name,
        roomCode: null,
        createdAt: now,
      };
    });

    await studentQueries.insertMany(studentRows);

    return { session, students: studentRows };
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
