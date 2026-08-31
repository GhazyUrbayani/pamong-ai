import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/auth';
import { messageQueries } from '@/db/queries/messages';
import { studentQueries } from '@/db/queries/students';
import { StudentJWT } from '@/types';

export async function GET(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload = await verifyToken(token) as StudentJWT & { sub: string };
    if (payload.role !== 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const student = studentQueries.getById(payload.sub);
    if (!student) return NextResponse.json({ error: 'Siswa tidak ditemukan.' }, { status: 404 });

    let messages;
    if (student.roomCode) {
      messages = await messageQueries.getByRoom(student.sessionId, student.roomCode);
    } else {
      messages = await messageQueries.getBySoloStudent(payload.sub);
    }

    // Count user messages for quota
    const chatUsed = messages.filter((m) => m.role === 'user').length;

    return NextResponse.json({ messages, chatUsed });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
