import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/auth';
import { getSessionService } from '@/services/session.service';
import { sessionQueries } from '@/db/queries/sessions';
import { TeacherJWT } from '@/types';

const sessionService = getSessionService();

// GET /api/sesi — list teacher's sessions
export async function GET(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload = await verifyToken(token) as TeacherJWT & { sub: string };
    if (payload.role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const sessions = await sessionQueries.getByTeacher(payload.sub);
    return NextResponse.json({ sessions });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

// POST /api/sesi — create new session
export async function POST(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload = await verifyToken(token) as TeacherJWT & { sub: string };
    if (payload.role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { title, subject, aiTheme, maxStudents, quotaPerStudent } = body;

    if (!title || !subject || !aiTheme) {
      return NextResponse.json(
        { error: 'Judul, mata pelajaran, dan tema AI wajib diisi.' },
        { status: 400 }
      );
    }

    const result = await sessionService.createSession({
      teacherId: payload.sub,
      title: title.trim(),
      subject: subject.trim(),
      aiTheme,
      maxStudents: Math.min(Number(maxStudents) || 20, 20),
      quotaPerStudent: Math.min(Number(quotaPerStudent) || 20, 50),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('[api/sesi POST]', err);
    return NextResponse.json({ error: 'Gagal membuat sesi.' }, { status: 500 });
  }
}
