import { NextRequest } from 'next/server';
import { getRecentEvents } from '@/lib/events/publisher';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const symbols = request.nextUrl.searchParams.get('symbols')?.split(',').map((s) => s.trim().toUpperCase()) ?? [];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: 'connected', symbols });

      const interval = setInterval(async () => {
        try {
          const events = await getRecentEvents(20);
          send({ type: 'events', events, at: new Date().toISOString() });
        } catch {
          send({ type: 'error', message: 'Failed to fetch events' });
        }
      }, 5000);

      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
