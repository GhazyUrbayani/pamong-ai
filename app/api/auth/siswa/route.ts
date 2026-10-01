import { NextRequest, NextResponse } from 'next/server';
import { signStudentToken } from '@/lib/auth';
import { throttleLogin, clearLoginThrottle } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    // Delay database imports until the request is inside the error boundary.
    // This keeps native SQLite/runtime failures from turning into an empty 500.
    const [{ studentQueries }, { sessionQueries }] = await Promise.all([
      import('@/db/queries/students'),
      import('@/db/queries/sessions'),
    ]);

    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi.' }, { status: 400 });
    }

    const cleanUsername = username.toLowerCase().trim();

    const throttle = throttleLogin('siswa', cleanUsername, req.headers);
    if (!throttle.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan masuk. Coba lagi beberapa menit lagi.' },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfterSeconds) } }
      );
    }

    const student = await studentQueries.getByUsername(cleanUsername);

    const passwordValid = student
      ? await bcrypt.compare(password, student.passwordHash)
      : false;

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
    });
  } catch (err) {
    console.error('[auth/siswa]', err);
    return NextResponse.json(
      {
        error: 'Layanan login belum tersedia pada deployment ini. Hubungi pengelola aplikasi.',
        code: 'BACKEND_UNAVAILABLE',
      },
      { status: 503 }
    );
  }
}
