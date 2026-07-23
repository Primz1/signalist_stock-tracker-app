import { inngest } from '@/lib/inngest/client';
import { connectToDatabase } from '@/database/mongoose';
import { Watchlist } from '@/database/models/watchlist.model';
import { saveMarketSnapshot } from '@/lib/actions/market.actions';
import { computeStockScore } from '@/lib/scoring/computeScore';

export const captureMarketSnapshots = inngest.createFunction(
  { id: 'capture-market-snapshots' },
  { cron: '*/15 * * * *' },
  async ({ step }) => {
    await connectToDatabase();
    const symbols = await step.run('load-symbols', async () => {
      const items = await Watchlist.find({}).select('symbol').lean();
      return Array.from(new Set(items.map((i) => String(i.symbol).toUpperCase())));
    });

    if (!symbols.length) return { success: true, processed: 0 };

    let processed = 0;
    for (const symbol of symbols as string[]) {
      await step.run(`snapshot-${symbol}`, async () => {
        await saveMarketSnapshot(symbol);
        await computeStockScore(symbol);
        processed += 1;
      });
    }

    return { success: true, processed };
  }
);
