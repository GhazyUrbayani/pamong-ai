import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/auth';
import { getSessionService } from '@/services/session.service';
import { TeacherJWT } from '@/types';

const sessionService = getSessionService();

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
    const result = await sessionService.getSessionWithStudents(id);

    if (!result) return NextResponse.json({ error: 'Sesi tidak ditemukan.' }, { status: 404 });
    if (result.session.teacherId !== payload.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
