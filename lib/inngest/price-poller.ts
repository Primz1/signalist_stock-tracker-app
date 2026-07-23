import { inngest } from '@/lib/inngest/client';
import { connectToDatabase } from '@/database/mongoose';
import { listActiveAlerts } from '@/database/models/alert.model';
import { publishPriceChanged } from '@/lib/events/publisher';
import { runAlertSweep } from '@/lib/inngest/alert-check';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const getToken = () => process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? '';

async function fetchPrice(symbol: string) {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (typeof data.c !== 'number') return null;
  return { price: data.c as number, changePercent: data.dp as number | undefined };
}

export const pollMarketPrices = inngest.createFunction(
  { id: 'poll-market-prices' },
  { cron: '*/1 * * * *' },
  async ({ step }) => {
    await connectToDatabase();
    const alerts = await step.run('load-symbols', async () => {
      const items = await listActiveAlerts();
      return Array.from(new Set(items.map((a) => a.symbol.toUpperCase())));
    });

    if (!(alerts as string[]).length) return { published: 0 };

    let published = 0;
    for (const symbol of alerts as string[]) {
      const quote = await step.run(`quote-${symbol}`, () => fetchPrice(symbol));
      if (!quote) continue;
      await step.run(`publish-${symbol}`, async () => {
        await publishPriceChanged({
          symbol,
          price: quote.price,
          changePercent: quote.changePercent,
          timestamp: new Date().toISOString(),
        });
        published += 1;
      });
    }

    await step.run('evaluate-alerts', runAlertSweep);
    return { published };
  }
);
