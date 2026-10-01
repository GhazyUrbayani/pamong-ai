import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/auth';
import { getMvpDemoSessionWithStudents } from '@/lib/mvp-demo-data';
import { TeacherJWT } from '@/types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload = await verifyToken(token) as TeacherJWT & { sub: string };
    if (payload.role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const mode = new URL(req.url).searchParams.get('mode') === 'real' ? 'real' : 'demo';

    if (mode === 'demo') {
      const result = getMvpDemoSessionWithStudents(id);
      if (!result) return NextResponse.json({ error: 'Sesi demo tidak ditemukan.' }, { status: 404 });
      return NextResponse.json({
        ...result,
        dataMode: 'demo',
        dataProvenance: 'synthetic',
      });
    }

    try {
      const { getSessionService } = await import('@/services/session.service');
      const result = await getSessionService().getSessionWithStudents(id);

      if (!result) return NextResponse.json({ error: 'Sesi tidak ditemukan.' }, { status: 404 });
      if (result.session.teacherId !== payload.sub) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      return NextResponse.json({
        ...result,
        dataMode: 'real',
        dataProvenance: 'database',
      });
    } catch (err) {
      console.error('[api/sesi/[id] GET real]', err);
      return NextResponse.json(
        { error: 'Real Data belum tersedia pada deployment ini.', code: 'REAL_DATA_UNAVAILABLE' },
        { status: 503 }
      );
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

/**
 * DELETE /api/sesi/[id] — erase a session and all personal data in it.
 *
 * Implements the data-subject erasure right for everything this session holds:
 * every student record, every transcript, and the indexed module text. Irreversible
 * and restricted to the teacher who owns the session.
 *
 * Deliberately API-only: there is no button in the teacher UI, so a demo cannot be
 * wiped by a misplaced click.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload = await verifyToken(token) as TeacherJWT & { sub: string };
    if (payload.role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const { getSessionService } = await import('@/services/session.service');
    const sessionService = getSessionService();
    const result = await sessionService.getSessionWithStudents(id);

    if (!result) return NextResponse.json({ error: 'Sesi tidak ditemukan.' }, { status: 404 });
    if (result.session.teacherId !== payload.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const studentCount = result.students.length;
    await sessionService.deleteSession(id);

    return NextResponse.json({
      deleted: true,
      sessionId: id,
      studentsDeleted: studentCount,
      message: 'Sesi, seluruh transkrip, dan data siswa telah dihapus permanen.',
    });
  } catch (err) {
    console.error('[api/sesi DELETE]', err);
    return NextResponse.json({ error: 'Gagal menghapus sesi.' }, { status: 500 });
  }
}
