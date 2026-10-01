import { NextRequest, NextResponse } from 'next/server';
import { signStudentToken } from '@/lib/auth';
import { throttleLogin, clearLoginThrottle } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';

const MVP_SESSION = {
  id: 'sesi-demo-biologi-fotosintesis',
  title: 'Kelas 10-A • Fotosintesis & Metabolisme Tumbuhan',
  subject: 'Biologi (Kelas 10-A)',
  aiTheme: 'biologi',
  quotaPerStudent: 20,
} as const;

const MVP_STUDENTS: Record<string, { id:string; displayName:string; password:string }> = {
  'ahmad.fauzi': { id:'std-sesi-demo-biologi-fotosintesis-1', displayName:'Ahmad Fauzi', password:'belajar123' },
  'dewi.lestari': { id:'std-sesi-demo-biologi-fotosintesis-2', displayName:'Dewi Lestari', password:'belajar123' },
  'siti.nurhaliza': { id:'std-sesi-demo-biologi-fotosintesis-5', displayName:'Siti Nurhaliza', password:'belajar123' },
  'budi.santoso': { id:'std-sesi-demo-biologi-fotosintesis-12', displayName:'Budi Santoso', password:'belajar123' },
};

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi.' }, { status: 400 });
    }

    const cleanUsername = String(username).toLowerCase().trim();
    const throttle = throttleLogin('siswa', cleanUsername, req.headers);
    if (!throttle.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan masuk. Coba lagi beberapa menit lagi.' },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfterSeconds) } }
      );
    }

    try {
      // Normal MVP path: generated session credentials are verified against SQLite.
      const [{ studentQueries }, { sessionQueries }] = await Promise.all([
        import('@/db/queries/students'),
        import('@/db/queries/sessions'),
      ]);

      const student = await studentQueries.getByUsername(cleanUsername);
      const passwordValid = student ? await bcrypt.compare(password, student.passwordHash) : false;

      if (!student || !passwordValid) {
        return NextResponse.json({ error: 'Username atau password salah.' }, { status: 401 });
      }

      const session = await sessionQueries.getById(student.sessionId);
      if (!session || session.status !== 'active') {
        return NextResponse.json({ error: 'Sesi kelas tidak aktif atau sudah berakhir.' }, { status: 403 });
      }

      clearLoginThrottle(throttle);
      const token = await signStudentToken({
        sub: student.id,
        role: 'student',
        username: student.username,
        sessionId: student.sessionId,
        displayName: student.displayName,
      });

      return NextResponse.json({
        token,
        student: {
          id: student.id,
          username: student.username,
          displayName: student.displayName,
          roomCode: student.roomCode,
        },
        session: {
          id: session.id,
          title: session.title,
          subject: session.subject,
          aiTheme: session.aiTheme,
          quotaPerStudent: session.quotaPerStudent,
        },
        mvpDemo: true,
      });
    } catch {
      // Explicit competition fallback: only the four documented demo accounts.
      // It exists so the login screen itself can be demonstrated on runtimes where
      // native SQLite cannot load. It is not a production authentication design.
      const demo = MVP_STUDENTS[cleanUsername];
      if (!demo || demo.password !== password) {
        return NextResponse.json(
          { error: 'Akun demo MVP tidak cocok atau backend SQLite tidak tersedia.' },
          { status: 503 }
        );
      }

      clearLoginThrottle(throttle);
      const token = await signStudentToken({
        sub: demo.id,
        role: 'student',
        username: cleanUsername,
        sessionId: MVP_SESSION.id,
        displayName: demo.displayName,
      });

      return NextResponse.json({
        token,
        student: {
          id: demo.id,
          username: cleanUsername,
          displayName: demo.displayName,
          roomCode: null,
        },
        session: MVP_SESSION,
        mvpDemo: true,
        databaseFallback: true,
      });
    }
  } catch (err) {
    console.error('[auth/siswa]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan pada akses demo MVP.' }, { status: 500 });
  }
}
