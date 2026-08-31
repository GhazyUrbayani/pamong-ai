import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/auth';
import { getRAGService } from '@/services/rag.service';
import { sessionQueries } from '@/db/queries/sessions';
import { TeacherJWT } from '@/types';

const ragService = getRAGService();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload = await verifyToken(token) as TeacherJWT & { sub: string };
    if (payload.role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id: sessionId } = await params;
    const session = sessionQueries.getById(sessionId);

    if (!session) return NextResponse.json({ error: 'Sesi tidak ditemukan.' }, { status: 404 });
    if (session.teacherId !== payload.sub) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan dalam request.' }, { status: 400 });
    }

    const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|txt|md)$/i)) {
      return NextResponse.json(
        { error: 'Format file tidak didukung. Gunakan PDF, TXT, atau MD.' },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File terlalu besar. Maksimal 10MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const chunksCount = await ragService.processDocument(sessionId, buffer, file.name);

    return NextResponse.json({
      success: true,
      chunksCount,
      filename: file.name,
      message: `Berhasil memproses ${chunksCount} bagian dari dokumen.`,
    });
  } catch (err) {
    console.error('[api/sesi/materi]', err);
    const message = err instanceof Error ? err.message : 'Gagal memproses dokumen.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
