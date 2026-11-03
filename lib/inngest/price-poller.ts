import { inngest } from '@/lib/inngest/client';
import { connectToDatabase } from '@/database/mongoose';
import { listActiveAlerts } from '@/database/models/alert.model';
import { PortfolioModel } from '@/database/models/portfolio.model';
import { Watchlist } from '@/database/models/watchlist.model';
import { getLatestPrices, publishPriceChanged } from '@/lib/events/publisher';
import { fetchPrice, runAlertSweep } from '@/lib/inngest/alert-check';
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
    const symbols = selectPollSymbols(alertSymbols, tracked, Math.floor(Date.now() / (POLL_MINUTES * 60_000)));

    if (!symbols.length) return { published: 0 };

    const previous = await getLatestPrices(symbols);
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const quote = await fetchPrice(symbol);
        if (!quote || quote.price === previous.get(symbol)?.price) return 0;
        await publishPriceChanged({
          symbol,
          price: quote.price,
          changePercent: quote.changePercent,
          timestamp: new Date().toISOString(),
        });
        return 1;
      })
    );

    const { triggered } = await runAlertSweep();
    return { published: results.reduce<number>((sum, n) => sum + n, 0), triggered };
  }
);
