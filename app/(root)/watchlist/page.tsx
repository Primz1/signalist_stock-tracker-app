import WatchlistClient from '@/components/watchlist/WatchlistClient';
import { getNews, searchStocks } from '@/lib/actions/finnhub.actions';
import { listWatchlist } from '@/lib/actions/watchlist.actions';
import { listAlerts } from '@/lib/actions/alert.actions';
import { getNotifications } from '@/lib/actions/alertNotification.actions';
import { connectToDatabase } from '@/database/mongoose';
import { StockScoreModel } from '@/database/models/stockScore.model';
import type { WatchlistEntry } from '@/components/watchlist/WatchlistClient';
import { marketData } from '@/lib/market/service';
import { isCryptoSymbol } from '@/lib/market/symbols';

async function loadMarketData(symbols: string[]) {
  const [quotes, fundamentals] = await Promise.all([
    marketData.getQuotes(symbols),
    Promise.all(symbols.map((symbol) => marketData.getFundamentals(symbol))),
  ]);
  return new Map(
    symbols.map((symbol, i) => {
      const quote = quotes.get(symbol);
      const entry: Partial<WatchlistEntry> = {
        price: quote?.price,
        changePercent: quote?.changePercent,
        volume: quote?.volume,
        dayHigh: quote?.high,
        dayLow: quote?.low,
        marketCap: fundamentals[i]?.marketCap,
        peRatio: fundamentals[i]?.peRatio,
        isCrypto: isCryptoSymbol(symbol),
      };
      return [symbol, entry];
    })
  );
}

const WatchlistPage = async () => {
  const [watchlistRes, alertsRes, notificationsRes] = await Promise.all([
    listWatchlist(),
    listAlerts(),
    getNotifications(),
  ]);
  const itemsRaw = watchlistRes.success ? watchlistRes.data : [];
  const symbols = itemsRaw.map((item) => (item.symbol || '').toUpperCase()).filter(Boolean);
  const alertsRaw = alertsRes.success ? alertsRes.data : [];
  const notificationsRaw = notificationsRes.success ? notificationsRes.data : [];

  const metricsBySymbol: Record<string, Partial<WatchlistEntry>> = {};
  const scoresBySymbol: Record<string, number> = {};
  if (symbols.length > 0) {
    const metrics = await loadMarketData(symbols);
    symbols.forEach((sym) => {
      metricsBySymbol[sym] = metrics.get(sym) ?? {};
    });
    await connectToDatabase();
    const scores = await StockScoreModel.find({ symbol: { $in: symbols } })
      .select('symbol score')
      .lean();
    scores.forEach((s) => {
      scoresBySymbol[String(s.symbol).toUpperCase()] = s.score;
    });
  }

  const watchlistItems: WatchlistEntry[] = itemsRaw.map((item) => {
    const symbolUpper = (item.symbol || '').toUpperCase();
    const metrics = metricsBySymbol[symbolUpper] ?? {};
    const isCrypto = metrics.isCrypto ?? isCryptoSymbol(symbolUpper);
    return {
      _id: item._id,
      symbol: symbolUpper,
      company: item.company,
      addedAt: item.addedAt,
      price: metrics.price,
      changePercent: metrics.changePercent,
      marketCap: metrics.marketCap,
      peRatio: metrics.peRatio,
      volume: metrics.volume,
      dayHigh: metrics.dayHigh,
      dayLow: metrics.dayLow,
      isCrypto,
      aiScore: scoresBySymbol[symbolUpper],
    };
  });

  const alerts = alertsRaw
    .map((item: any) => ({
      _id:
        typeof item._id === 'object' && 'toString' in item._id
          ? (item._id as any).toString()
          : ((item._id as any) ?? undefined),
      symbol: (item.symbol || '').toUpperCase(),
      company: item.company,
      alertName: item.alertName,
      alertType: item.alertType ?? 'price',
      condition: item.condition,
      threshold: item.threshold,
      frequency: item.frequency,
      isActive: item.isActive,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : undefined,
      lastTriggeredAt: item.lastTriggeredAt
        ? new Date(item.lastTriggeredAt).toISOString()
        : undefined,
      lastNotifiedAt: item.lastNotifiedAt ? new Date(item.lastNotifiedAt).toISOString() : undefined,
      lastPrice: item.lastPrice,
      lastChangePercent: item.lastChangePercent,
    }))
    .map((a) => ({ ...a }));

  const notifications = notificationsRaw
    .map((n: any) => ({
      _id:
        typeof n._id === 'object' && 'toString' in n._id
          ? (n._id as any).toString()
          : ((n._id as any) ?? undefined),
      alertId:
        typeof n.alertId === 'object' && 'toString' in n.alertId
          ? (n.alertId as any).toString()
          : String(n.alertId ?? ''),
      symbol: (n.symbol || '').toUpperCase(),
      company: n.company,
      message: n.message,
      price: n.price,
      changePercent: n.changePercent,
      triggeredAt: n.triggeredAt ? new Date(n.triggeredAt).toISOString() : new Date().toISOString(),
      read: Boolean(n.read),
    }))
    .map((n) => ({ ...n }));

  const initialStocks = await searchStocks(undefined, symbols);
  const news = await getNews(symbols.slice(0, 6));

  return (
    <WatchlistClient
      initialItems={watchlistItems}
      initialStocks={initialStocks}
      initialSymbols={symbols}
      initialAlerts={alerts}
      initialNotifications={notifications}
      initialNews={news}
    />
  );
};

export default WatchlistPage;
