import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/auth';
import { getSessionService } from '@/services/session.service';
import { sessionQueries } from '@/db/queries/sessions';
import { TeacherJWT } from '@/types';

const sessionService = getSessionService();

/**
 * POST /api/sesi/[id]/kredensial — reset student passwords and return them once.
 *
 * Student passwords are stored only as bcrypt hashes, so a lost password cannot be
 * looked up. A teacher issues a new one instead. This is the only endpoint in the
 * application that ever emits a student password, and it emits one it just created.
 *
 * Body: { studentIds?: string[] } — omit to reset the whole class.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload = (await verifyToken(token)) as TeacherJWT & { sub: string };
    if (payload.role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: sessionId } = await params;
    const session = sessionQueries.getById(sessionId);

    if (!session) return NextResponse.json({ error: 'Sesi tidak ditemukan.' }, { status: 404 });
    if (session.teacherId !== payload.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // An absent body means "reset everyone".
    let studentIds: string[] | undefined;
    try {
      const body = await req.json();
      if (Array.isArray(body?.studentIds)) studentIds = body.studentIds;
    } catch {
      studentIds = undefined;
    }

    const credentials = await sessionService.resetCredentials(sessionId, studentIds);

    if (credentials.length === 0) {
      return NextResponse.json({ error: 'Tidak ada siswa yang cocok.' }, { status: 404 });
    }

    return NextResponse.json({
      credentials,
      message:
        `${credentials.length} kredensial dibuat ulang. ` +
        'Salin sekarang — password ini tidak dapat ditampilkan lagi.',
    });
  } catch (err) {
    console.error('[api/sesi/kredensial]', err);
    return NextResponse.json({ error: 'Gagal membuat ulang kredensial.' }, { status: 500 });
  }
}
