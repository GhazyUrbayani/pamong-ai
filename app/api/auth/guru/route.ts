import { NextRequest, NextResponse } from 'next/server';
import { signTeacherToken } from '@/lib/auth';
import { throttleLogin, clearLoginThrottle } from '@/lib/rate-limit';

// Competition MVP access only. This is intentionally not a production auth system.
const MVP_TEACHER_EMAIL = process.env.MVP_TEACHER_EMAIL ?? 'guru@pamong-ai.id';
const MVP_TEACHER_PASSWORD = process.env.MVP_TEACHER_PASSWORD ?? 'demo1234';
const MVP_TEACHER_FALLBACK_ID = 'teacher-ibu-sari-001';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi.' }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const throttle = throttleLogin('guru', cleanEmail, req.headers);
    if (!throttle.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan masuk. Coba lagi beberapa menit lagi.' },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfterSeconds) } }
      );
    }

    if (cleanEmail !== MVP_TEACHER_EMAIL || password !== MVP_TEACHER_PASSWORD) {
      return NextResponse.json(
        { error: 'Akun demo MVP tidak cocok. Gunakan kredensial demo yang ditampilkan pada halaman login.' },
        { status: 401 }
      );
    }

    // Resolve the seeded teacher id when SQLite is available. On a runtime where
    // the native database cannot load, the fixed demo id still lets the login
    // screen demonstrate MVP access without pretending this is production auth.
    let teacher = {
      id: MVP_TEACHER_FALLBACK_ID,
      name: 'Ibu Sari, S.Pd.',
      email: MVP_TEACHER_EMAIL,
    };
    try {
      const [{ db }, { teachers }, { eq }] = await Promise.all([
        import('@/db/client'),
        import('@/db/schema'),
        import('drizzle-orm'),
      ]);
      const stored = db.select().from(teachers).where(eq(teachers.email, MVP_TEACHER_EMAIL)).get();
      if (stored) teacher = { id: stored.id, name: stored.name, email: stored.email };
    } catch {
      console.warn('[auth/guru] SQLite unavailable; using explicit MVP demo identity.');
    }

    clearLoginThrottle(throttle);

    const token = await signTeacherToken({
      sub: teacher.id,
      role: 'teacher',
      name: teacher.name,
      email: teacher.email,
    });

    return NextResponse.json({ token, teacher, mvpDemo: true });
  } catch (err) {
    console.error('[auth/guru]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan pada akses demo MVP.' }, { status: 500 });
  }
}
