import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/auth';
import { messageQueries } from '@/db/queries/messages';
import { studentQueries } from '@/db/queries/students';
import { sessionQueries } from '@/db/queries/sessions';
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
    const student = studentQueries.getById(studentId);
    if (!student) return NextResponse.json({ error: 'Siswa tidak ditemukan.' }, { status: 404 });

    // A teacher role alone is NOT enough: this response carries the student's full
    // transcript and their password. Confirm the student sits in a session this
    // teacher owns, or any teacher account could read any student in the database.
    const session = sessionQueries.getById(student.sessionId);
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
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
