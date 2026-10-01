import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/auth';
import { getMvpDemoStudentTranscript } from '@/lib/mvp-demo-data';
import { TeacherJWT } from '@/types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload = await verifyToken(token) as TeacherJWT & { sub: string };
    if (payload.role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { studentId } = await params;
    const mode = new URL(req.url).searchParams.get('mode') === 'real' ? 'real' : 'demo';

    if (mode === 'demo') {
      const transcript = getMvpDemoStudentTranscript(studentId);
      if (!transcript) return NextResponse.json({ error: 'Siswa demo tidak ditemukan.' }, { status: 404 });
      return NextResponse.json({
        ...transcript,
        dataMode: 'demo',
        dataProvenance: 'synthetic',
      });
    }

    try {
      const [{ messageQueries }, { studentQueries }, { sessionQueries }] = await Promise.all([
        import('@/db/queries/messages'),
        import('@/db/queries/students'),
        import('@/db/queries/sessions'),
      ]);

      const student = await studentQueries.getById(studentId);
      if (!student) return NextResponse.json({ error: 'Siswa tidak ditemukan.' }, { status: 404 });

      // A teacher role alone is NOT enough: confirm the student belongs to this teacher.
      const session = await sessionQueries.getById(student.sessionId);
      if (!session || session.teacherId !== payload.sub) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const messages = await messageQueries.getBySoloStudent(studentId);
      const chatUsed = messages.filter((m) => m.role === 'user').length;

      return NextResponse.json({
        student: {
          id: student.id,
          username: student.username,
          displayName: student.displayName,
          sessionId: student.sessionId,
        },
        messages,
        chatUsed,
        dataMode: 'real',
        dataProvenance: 'database',
      });
    } catch (err) {
      console.error('[student transcript real data unavailable]', err);
      return NextResponse.json(
        { error: 'Real Data belum tersedia pada deployment ini.', code: 'REAL_DATA_UNAVAILABLE' },
        { status: 503 }
      );
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
