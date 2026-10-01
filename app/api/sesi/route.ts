import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/auth';
import { MVP_DEMO_SESSIONS } from '@/lib/mvp-demo-data';
import { TeacherJWT } from '@/types';

// GET /api/sesi — list teacher's sessions
export async function GET(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload = await verifyToken(token) as TeacherJWT & { sub: string };
    if (payload.role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const mode = new URL(req.url).searchParams.get('mode') === 'real' ? 'real' : 'demo';

    if (mode === 'demo') {
      return NextResponse.json({
        sessions: MVP_DEMO_SESSIONS,
        dataMode: 'demo',
        dataProvenance: 'synthetic',
      });
    }

    try {
      const { sessionQueries } = await import('@/db/queries/sessions');
      const sessions = await sessionQueries.getByTeacher(payload.sub);
      return NextResponse.json({
        sessions,
        dataMode: 'real',
        dataProvenance: 'database',
      });
    } catch (err) {
      console.error('[api/sesi GET real]', err);
      return NextResponse.json(
        {
          error: 'Real Data belum tersedia pada deployment ini.',
          code: 'REAL_DATA_UNAVAILABLE',
          dataMode: 'real',
        },
        { status: 503 }
      );
    }
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
    const { title, subject, aiTheme, maxStudents, quotaPerStudent, guardianConsent } = body;

    if (!title || !subject || !aiTheme) {
      return NextResponse.json(
        { error: 'Judul, mata pelajaran, dan tema AI wajib diisi.' },
        { status: 400 }
      );
    }

    if (guardianConsent !== true) {
      return NextResponse.json(
        {
          error:
            'Konfirmasi persetujuan orang tua/wali wajib sebelum kelas dibuat (UU PDP No. 27/2022).',
        },
        { status: 400 }
      );
    }

    const { getSessionService } = await import('@/services/session.service');
    const result = await getSessionService().createSession({
      teacherId: payload.sub,
      title: title.trim(),
      subject: subject.trim(),
      aiTheme,
      maxStudents: Math.min(Number(maxStudents) || 20, 20),
      quotaPerStudent: Math.min(Number(quotaPerStudent) || 20, 50),
      guardianConsent: true,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('[api/sesi POST]', err);
    return NextResponse.json(
      {
        error: 'Pembuatan sesi Real Data memerlukan backend persistence yang kompatibel. Mode Demo memakai kelas sintetik tetap dan bersifat read-only.',
        code: 'MVP_DEMO_READ_ONLY',
      },
      { status: 503 }
    );
  }
}
