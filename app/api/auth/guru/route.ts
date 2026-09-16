import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { teachers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { signTeacherToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { runMigrations, seedTeacher } from '@/db/migrate';
import { throttleLogin, clearLoginThrottle } from '@/lib/rate-limit';

// Ensure DB is ready on first call
let initialized = false;
async function ensureInit() {
  if (initialized) return;
  runMigrations();
  await seedTeacher();
  initialized = true;
}

export async function POST(req: NextRequest) {
  await ensureInit();

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Throttle before touching the database or bcrypt: an unthrottled endpoint is
    // an open credential-guessing surface, and bcrypt work is a DoS lever too.
    const throttle = throttleLogin('guru', cleanEmail, req.headers);
    if (!throttle.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan masuk. Coba lagi beberapa menit lagi.' },
        { status: 429, headers: { 'Retry-After': String(throttle.retryAfterSeconds) } }
      );
    }

    let teacher = db
      .select()
      .from(teachers)
      .where(eq(teachers.email, cleanEmail))
      .get();

    // Fallback alias support
    if (!teacher && cleanEmail === 'guru@edumentor.id') {
      teacher = db
        .select()
        .from(teachers)
        .where(eq(teachers.email, 'guru@pamong-ai.id'))
        .get();
    }

    if (!teacher) {
      return NextResponse.json({ error: 'Email atau password salah.' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, teacher.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Email atau password salah.' }, { status: 401 });
    }

    clearLoginThrottle(throttle);

    const token = await signTeacherToken({
      sub: teacher.id,
      role: 'teacher',
      name: teacher.name,
      email: teacher.email,
    });

    return NextResponse.json({
      token,
      teacher: { id: teacher.id, name: teacher.name, email: teacher.email },
    });
  } catch (err) {
    console.error('[auth/guru]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
