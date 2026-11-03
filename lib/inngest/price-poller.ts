import { inngest } from '@/lib/inngest/client';
import { connectToDatabase } from '@/database/mongoose';
import { listActiveAlerts } from '@/database/models/alert.model';
import { PortfolioModel } from '@/database/models/portfolio.model';
import { Watchlist } from '@/database/models/watchlist.model';
import { getLatestPrices, publishPriceChanged } from '@/lib/events/publisher';
import { runAlertSweep } from '@/lib/inngest/alert-check';
import { runIntelligencePipeline } from '@/lib/intelligence/pipeline';
import { logError } from '@/lib/logger';
import { marketData } from '@/lib/market/service';
import { selectPollSymbols } from '@/lib/market/poll-symbols';

const POLL_MINUTES = 2;

// Inngest's free plan allows 50,000 executions a month and counts every step as one.
// No steps here: this runs 21,600 times a month and is safe to retry from the top.
export const pollMarketPrices = inngest.createFunction(
  { id: 'poll-market-prices' },
  { cron: `*/${POLL_MINUTES} * * * *` },
  async () => {
    await connectToDatabase();
    const [alerts, watchlist, holdings] = await Promise.all([
      listActiveAlerts(),
      Watchlist.distinct('symbol'),
      PortfolioModel.distinct('holdings.symbol'),
    ]);
    const alertSymbols = alerts.map((a) => a.symbol.toUpperCase());
    const tracked = [...watchlist, ...holdings].map((s) => String(s).toUpperCase());
    // Quotes come from Finnhub's per-minute budget. Analysis uses candles, which don't.
    const symbols = selectPollSymbols(alertSymbols, tracked, Math.floor(Date.now() / (POLL_MINUTES * 60_000)));

    const [previous, quotes] = await Promise.all([getLatestPrices(symbols), marketData.getQuotes(symbols)]);
    const changedQuotes = [...quotes.values()].filter((quote) => quote.price !== previous.get(quote.symbol)?.price);
    await Promise.all(
      changedQuotes.map((quote) =>
        publishPriceChanged({
          symbol: quote.symbol,
          price: quote.price,
          changePercent: quote.changePercent,
          timestamp: new Date().toISOString(),
        })
      )
    );

    const { triggered } = await runAlertSweep(quotes);

    // A pipeline failure must not undo the quotes and alerts above
    const intelligence = await runIntelligencePipeline([...tracked, ...alertSymbols]).catch((err) => {
      logError('intelligence pipeline failed', { error: err instanceof Error ? err.message : String(err) });
      return null;
    });
    if (intelligence?.changed.length) {
      await inngest.send(
        intelligence.changed.map((signal) => ({
          name: 'app/signal.changed' as const,
          // Same id for the same signal state, so a retried run doesn't trigger twice
          id: `${signal.signalId}:${signal.status}:${signal.updatedAt}`,
          data: { signalId: signal.signalId, symbol: signal.symbol, status: signal.status },
        }))
      );
    }

    return {
      published: changedQuotes.length,
      quoted: quotes.size,
      triggered,
      analyzed: intelligence?.analyzed.length ?? 0,
      events: intelligence?.events ?? 0,
      signalsChanged: intelligence?.changed.length ?? 0,
    };
  }
);
