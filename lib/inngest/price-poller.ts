import { inngest } from '@/lib/inngest/client';
import { connectToDatabase } from '@/database/mongoose';
import { listActiveAlerts } from '@/database/models/alert.model';
import { PortfolioModel } from '@/database/models/portfolio.model';
import { Watchlist } from '@/database/models/watchlist.model';
import { getLatestPrices, publishPriceChanged } from '@/lib/events/publisher';
import { fetchPrice, runAlertSweep } from '@/lib/inngest/alert-check';
import { selectPollSymbols } from '@/lib/market/poll-symbols';

export const pollMarketPrices = inngest.createFunction(
  { id: 'poll-market-prices' },
  { cron: '*/1 * * * *' },
  async ({ step }) => {
    await connectToDatabase();
    const symbols = await step.run('load-symbols', async () => {
      const [alerts, watchlist, holdings] = await Promise.all([
        listActiveAlerts(),
        Watchlist.distinct('symbol'),
        PortfolioModel.distinct('holdings.symbol'),
      ]);
      const alertSymbols = alerts.map((a) => a.symbol.toUpperCase());
      const tracked = [...watchlist, ...holdings].map((s) => String(s).toUpperCase());
      return selectPollSymbols(alertSymbols, tracked, Math.floor(Date.now() / 60_000));
    });

    if (!symbols.length) return { published: 0 };

    // One step for the whole batch: a step per symbol would burn Inngest's free-tier runs
    const published = await step.run('publish-quotes', async () => {
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
      return results.reduce<number>((sum, n) => sum + n, 0);
    });

    await step.run('evaluate-alerts', runAlertSweep);
    return { published };
  }
);
