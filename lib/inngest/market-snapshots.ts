import { inngest } from '@/lib/inngest/client';
import { connectToDatabase } from '@/database/mongoose';
import { Watchlist } from '@/database/models/watchlist.model';
import { saveMarketSnapshot } from '@/lib/actions/market.actions';
import { computeStockScore } from '@/lib/scoring/computeScore';
import { detectAndPublishSignals } from '@/lib/market/signal-runner';
import { logError } from '@/lib/logger';

// No per-symbol steps: each one counts against Inngest's 50,000 monthly executions
export const captureMarketSnapshots = inngest.createFunction(
  { id: 'capture-market-snapshots' },
  { cron: '*/15 * * * *' },
  async ({ step }) => {
    await connectToDatabase();
    const items = await Watchlist.find({}).select('symbol').lean();
    const symbols = Array.from(new Set(items.map((i) => String(i.symbol).toUpperCase())));
    if (!symbols.length) return { success: true, processed: 0 };

    let processed = 0;
    const detected: { symbol: string; signals: Awaited<ReturnType<typeof detectAndPublishSignals>> }[] = [];

    for (const symbol of symbols) {
      try {
        await saveMarketSnapshot(symbol);
        await computeStockScore(symbol);
        processed += 1;
        const signals = await detectAndPublishSignals(symbol);
        if (signals.length) detected.push({ symbol, signals });
      } catch (err) {
        // One bad symbol must not stop the rest of the sweep
        logError('snapshot failed', { symbol, error: err instanceof Error ? err.message : String(err) });
      }
    }

    if (detected.length) {
      await step.sendEvent(
        'notify-signals',
        detected.map(({ symbol, signals }) => ({ name: 'app/signals.detected', data: { symbol, signals } }))
      );
    }

    return { success: true, processed };
  }
);
