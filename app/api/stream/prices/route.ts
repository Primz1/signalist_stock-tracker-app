import { NextRequest } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { getRecentEvents } from '@/lib/events/publisher';
import { getTrackedSymbols } from '@/lib/market/tracked-symbols';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CHECK_INTERVAL_MS = 10_000;
// Ends before Vercel's limit. EventSource reconnects and resumes from Last-Event-ID.
const STREAM_LIFETIME_MS = 50_000;

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return Response.json({ message: 'Not authenticated' }, { status: 401 });
  }

  const userId = session.user.id;
  const symbols = await getTrackedSymbols(userId);
  const { searchParams } = request.nextUrl;
  const cursor = request.headers.get('last-event-id') ?? searchParams.get('after') ?? undefined;

  // Plain JSON for the client's polling fallback when SSE can't connect
  if (searchParams.get('once') === '1') {
    const events = await getRecentEvents({ userId, symbols, afterId: cursor });
    return Response.json({ events });
  }

  let afterId = cursor ?? (await getRecentEvents({ userId, symbols, limit: 1 }))[0]?.id;
  let timer: ReturnType<typeof setInterval> | undefined;
  let lifetime: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        clearTimeout(lifetime);
        controller.close();
      };

      const sendNewEvents = async () => {
        try {
          const events = await getRecentEvents({ userId, symbols, afterId });
          if (closed) return;
          for (const event of events.reverse()) {
            controller.enqueue(encoder.encode(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`));
            afterId = event.id;
          }
          if (!events.length) controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          close();
        }
      };

      controller.enqueue(encoder.encode('retry: 3000\n\n'));
      void sendNewEvents();
      timer = setInterval(sendNewEvents, CHECK_INTERVAL_MS);
      lifetime = setTimeout(close, STREAM_LIFETIME_MS);
      request.signal.addEventListener('abort', close);
    },
    cancel() {
      closed = true;
      clearInterval(timer);
      clearTimeout(lifetime);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
