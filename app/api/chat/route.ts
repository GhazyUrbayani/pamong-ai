import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/auth';
import { getChatService } from '@/services/chat.service';
import { StudentJWT } from '@/types';

const chatService = getChatService();

export async function POST(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload = await verifyToken(token) as StudentJWT & { sub: string };
    if (payload.role !== 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { message } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Pesan tidak boleh kosong.' }, { status: 400 });
    }

    if (message.length > 1000) {
      return NextResponse.json({ error: 'Pesan terlalu panjang. Maksimal 1000 karakter.' }, { status: 400 });
    }

    const result = await chatService.chat({
      studentId: payload.sub,
      sessionId: payload.sessionId,
      message: message.trim(),
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/chat]', err);
    return NextResponse.json({ error: 'Gagal mengirim pesan.' }, { status: 500 });
  }
}
