import { Message, Session, Student, StudentStats } from '@/types';

const TEACHER_ID = 'teacher-ibu-sari-001';
const CREATED_AT = Date.UTC(2026, 8, 29, 7, 0, 0);

export const MVP_DEMO_SESSIONS: Session[] = [
  {
    id: 'sesi-demo-biologi-fotosintesis',
    teacherId: TEACHER_ID,
    title: 'Kelas 10-A • Fotosintesis & Metabolisme Tumbuhan',
    subject: 'Biologi (Kelas 10-A)',
    aiTheme: 'biologi',
    maxStudents: 20,
    quotaPerStudent: 20,
    status: 'active',
    createdAt: CREATED_AT,
    guardianConsentAt: null,
    guardianConsentStatement: null,
  },
  {
    id: 'sesi-demo-biologi-sel-10b',
    teacherId: TEACHER_ID,
    title: 'Kelas 10-B • Struktur Sel & Transpor Membran',
    subject: 'Biologi (Kelas 10-B)',
    aiTheme: 'biologi',
    maxStudents: 20,
    quotaPerStudent: 20,
    status: 'active',
    createdAt: CREATED_AT + 60_000,
    guardianConsentAt: null,
    guardianConsentStatement: null,
  },
  {
    id: 'sesi-demo-biologi-sirkulasi-11ipa1',
    teacherId: TEACHER_ID,
    title: 'Kelas 11-IPA 1 • Sistem Sirkulasi & Fisiologi Darah',
    subject: 'Biologi (Kelas 11-IPA 1)',
    aiTheme: 'biologi',
    maxStudents: 20,
    quotaPerStudent: 20,
    status: 'active',
    createdAt: CREATED_AT + 120_000,
    guardianConsentAt: null,
    guardianConsentStatement: null,
  },
];

const STUDENT_TEMPLATES = [
  ['Ahmad Fauzi', 'ahmad.fauzi'],
  ['Dewi Lestari', 'dewi.lestari'],
  ['Zahra Aulia', 'zahra.aulia'],
  ['Kevin Sanjaya', 'kevin.sanjaya'],
  ['Siti Nurhaliza', 'siti.nurhaliza'],
  ['Rian Hidayat', 'rian.hidayat'],
  ['Nabila Putri', 'nabila.putri'],
  ['Dimas Anggara', 'dimas.anggara'],
  ['Putri Maharani', 'putri.maharani'],
  ['Rizky Ramadhan', 'rizky.ramadhan'],
  ['Tiara Andini', 'tiara.andini'],
  ['Budi Santoso', 'budi.santoso'],
  ['Anisa Rahmawati', 'anisa.rahma'],
  ['Fajar Nugraha', 'fajar.nugraha'],
  ['Hendra Setiawan', 'hendra.setiawan'],
  ['Farhan Maulana', 'farhan.m'],
  ['Salma Salsabila', 'salma.salsabila'],
  ['Yoga Pratama', 'yoga.pratama'],
  ['Maya Safitri', 'maya.safitri'],
  ['Gita Gutawa', 'gita.gutawa'],
] as const;

const SESSION_SUFFIX: Record<string, string> = {
  'sesi-demo-biologi-fotosintesis': '',
  'sesi-demo-biologi-sel-10b': '.10b',
  'sesi-demo-biologi-sirkulasi-11ipa1': '.11a',
};

const CATEGORY_PATTERNS = [
  [2, 3, 2, 1],
  [1, 4, 3, 0],
  [3, 2, 1, 1],
  [1, 2, 4, 0],
  [2, 4, 1, 0],
  [3, 3, 0, 1],
  [2, 2, 2, 0],
  [1, 3, 2, 1],
  [4, 1, 1, 0],
  [2, 3, 3, 0],
  [1, 4, 2, 0],
  [5, 1, 0, 1],
  [3, 2, 0, 0],
  [2, 2, 1, 0],
  [4, 1, 0, 0],
  [0, 1, 0, 0],
  [1, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
] as const;

function studentId(sessionId: string, index: number) {
  return `std-${sessionId}-${index + 1}`;
}

export function getMvpDemoSession(sessionId: string): Session | null {
  return MVP_DEMO_SESSIONS.find((session) => session.id === sessionId) ?? null;
}

export function getMvpDemoStudents(sessionId: string): Student[] {
  const suffix = SESSION_SUFFIX[sessionId];
  if (suffix === undefined) return [];

  return STUDENT_TEMPLATES.map(([displayName, baseUsername], index) => ({
    id: studentId(sessionId, index),
    sessionId,
    username: `${baseUsername}${suffix}`,
    passwordHash: '[synthetic-demo-not-used-for-auth]',
    displayName,
    roomCode: null,
    createdAt: CREATED_AT + index * 1_000,
  }));
}

export function getMvpDemoSessionWithStudents(sessionId: string) {
  const session = getMvpDemoSession(sessionId);
  if (!session) return null;
  return { session, students: getMvpDemoStudents(sessionId) };
}

export function getMvpDemoStats(sessionId: string): StudentStats[] {
  const students = getMvpDemoStudents(sessionId);
  return students.map((student, index) => {
    const [hafalan, pemahaman, analisis, unclassified] = CATEGORY_PATTERNS[index];
    const categoryTotal = hafalan + pemahaman + analisis;
    return {
      id: student.id,
      username: student.username,
      displayName: student.displayName,
      chatUsed: categoryTotal + unclassified,
      quotaTotal: 20,
      categories: { hafalan, pemahaman, analisis },
      // Synthetic demo categories are intentionally NOT counted as model-valid.
      validClassified: 0,
      unclassified,
      totalQuestions: categoryTotal + unclassified,
    };
  });
}

const SAMPLE_QUESTIONS = [
  {
    level: 'hafalan' as const,
    user: 'Apa fungsi klorofil pada fotosintesis?',
    assistant: 'Contoh jawaban demo: klorofil menyerap energi cahaya yang digunakan pada reaksi terang.',
  },
  {
    level: 'pemahaman' as const,
    user: 'Mengapa reaksi gelap tetap membutuhkan hasil reaksi terang?',
    assistant: 'Contoh jawaban demo: siklus Calvin menggunakan ATP dan NADPH yang dihasilkan pada reaksi terang.',
  },
  {
    level: 'analisis' as const,
    user: 'Apa yang terjadi jika intensitas cahaya tinggi tetapi CO2 sangat rendah?',
    assistant: 'Contoh jawaban demo: laju fotosintesis akan dibatasi ketersediaan CO2 walaupun cahaya berlimpah.',
  },
];

export function getMvpDemoStudentTranscript(studentIdValue: string) {
  for (const session of MVP_DEMO_SESSIONS) {
    const students = getMvpDemoStudents(session.id);
    const student = students.find((item) => item.id === studentIdValue);
    if (!student) continue;

    const questions = SAMPLE_QUESTIONS.slice(0, student.id.endsWith('-1') ? 3 : 2);
    const messages: Message[] = questions.flatMap((sample, index) => {
      const createdAt = CREATED_AT + index * 120_000;
      return [
        {
          id: `demo-user-${student.id}-${index}`,
          sessionId: session.id,
          studentId: student.id,
          roomCode: null,
          role: 'user' as const,
          content: sample.user,
          questionLevel: sample.level,
          classificationProvenance: 'synthetic' as const,
          createdAt,
        },
        {
          id: `demo-assistant-${student.id}-${index}`,
          sessionId: session.id,
          studentId: student.id,
          roomCode: null,
          role: 'assistant' as const,
          content: sample.assistant,
          questionLevel: null,
          classificationProvenance: null,
          createdAt: createdAt + 1_000,
        },
      ];
    });

    return {
      student: {
        id: student.id,
        username: student.username,
        displayName: student.displayName,
        sessionId: student.sessionId,
      },
      messages,
      chatUsed: questions.length,
    };
  }
  return null;
}
