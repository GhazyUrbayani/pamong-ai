import { NextRequest } from 'next/server';
import { verifyToken, extractBearerToken } from '@/lib/auth';
import { getMvpDemoSession, getMvpDemoStats } from '@/lib/mvp-demo-data';
import { TeacherJWT } from '@/types';

/**
 * SSE endpoint for real-time dashboard updates.
 * Streams StudentStats[] every time a new message arrives (polling every 3s).
 * 
 * Note: True push would require a pub/sub system. For MVP demo,
 * server-side polling on SSE connection is sufficient and visually identical.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sesiId: string }> }
) {
  const token = extractBearerToken(req.headers.get('authorization'));

  // For SSE, token can also be in query param (EventSource doesn't support custom headers)
  const url = new URL(req.url);
  const queryToken = url.searchParams.get('token');
  const authToken = token ?? queryToken;

  if (!authToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const payload = await verifyToken(authToken) as TeacherJWT & { sub: string };
    if (payload.role !== 'teacher') return new Response('Forbidden', { status: 403 });

    const { sesiId } = await params;

    // Prefer the database path. If native SQLite is unavailable (for example on
    // a Cloudflare Workers MVP deployment), fall back to explicit synthetic data.
    let mvpDemo = false;
    let statsProvider: () => Promise<unknown>;

    try {
      const [{ sessionQueries }, { getChatService }] = await Promise.all([
        import('@/db/queries/sessions'),
        import('@/services/chat.service'),
      ]);
      const session = await sessionQueries.getById(sesiId);
      if (!session) return new Response('Not Found', { status: 404 });
      if (session.teacherId !== payload.sub) return new Response('Forbidden', { status: 403 });
      const chatService = getChatService();
      statsProvider = () => chatService.computeStudentStats(sesiId);
    } catch {
      const session = getMvpDemoSession(sesiId);
      if (!session) return new Response('Not Found', { status: 404 });
      mvpDemo = true;
      statsProvider = async () => getMvpDemoStats(sesiId);
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendStats = async () => {
          try {
            const stats = await statsProvider();
            const data = `data: ${JSON.stringify({
              stats,
              mvpDemo,
              dataProvenance: mvpDemo ? 'synthetic' : 'database',
            })}\n\n`;
            controller.enqueue(encoder.encode(data));
          } catch (err) {
            console.error('[SSE] Error computing stats:', err);
          }
        };

        // Send immediately on connect.
        await sendStats();

        // Real data polls frequently; synthetic MVP data is stable.
        const interval = setInterval(sendStats, mvpDemo ? 30000 : 3000);

        // Heartbeat to keep connection alive
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': ping\n\n'));
          } catch {
            clearInterval(heartbeat);
            clearInterval(interval);
          }
        }, 20000);

        // Cleanup when client disconnects
        req.signal.addEventListener('abort', () => {
          clearInterval(interval);
          clearInterval(heartbeat);
          try { controller.close(); } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }
}
