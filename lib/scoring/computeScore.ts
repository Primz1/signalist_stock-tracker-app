import { connectToDatabase } from '@/database/mongoose';
import { getLatestSnapshot } from '@/database/models/marketSnapshot.model';
import { upsertStockScore } from '@/database/models/stockScore.model';
import { getNews } from '@/lib/actions/finnhub.actions';
import { fetchOhlcv } from '@/lib/market/ohlcv';
import { computeIndicators } from '@/lib/market/indicators';

export async function computeStockScore(symbol: string) {
  const sym = symbol.toUpperCase();
  await connectToDatabase();

  let indicators = null as ReturnType<typeof computeIndicators> | null;
  const snapshot = await getLatestSnapshot(sym);

  if (snapshot?.indicators) {
    indicators = {
      sma20: snapshot.indicators.sma20 ?? 0,
      sma50: snapshot.indicators.sma50 ?? 0,
      rsi14: snapshot.indicators.rsi14 ?? 50,
      macd: snapshot.indicators.macd ?? { macd: 0, signal: 0, histogram: 0 },
      bollinger: snapshot.indicators.bollinger ?? { upper: 0, middle: 0, lower: 0 },
      series: { sma20: [], sma50: [], rsi14: [], macd: { macdLine: [], signalLine: [], histogram: [] }, bollinger: { upper: [], middle: [], lower: [] } },
    };
  } else {
    const candles = await fetchOhlcv(sym);
    if (candles.length) indicators = computeIndicators(candles);
  }

  const candles = await fetchOhlcv(sym, 30);
  const momentum =
    candles.length >= 2
      ? ((candles[candles.length - 1].close - candles[0].close) / candles[0].close) * 100
      : 0;

  let newsScore = 10;
  try {
    const news = await getNews([sym]);
    newsScore = Math.min(25, 10 + news.length * 2);
  } catch {
    newsScore = 10;
  }

  const technical = indicators
    ? Math.min(25, Math.max(0, 15 + (indicators.macd.histogram > 0 ? 10 : -5) + (indicators.rsi14 > 50 ? 5 : -5)))
    : 12;

  const momentumFactor = Math.min(20, Math.max(-10, momentum * 2));
  const risk = indicators
    ? Math.min(0, Math.max(-15, indicators.rsi14 > 75 ? -10 : indicators.rsi14 < 25 ? 5 : 0))
    : 0;
  const earnings = 15;

  const factors = {
    technical: Math.round(technical),
    news: Math.round(newsScore),
    momentum: Math.round(momentumFactor),
    risk: Math.round(risk),
    earnings: Math.round(earnings),
  };

  const score = Math.min(100, Math.max(0, Object.values(factors).reduce((a, b) => a + b, 0)));

  await upsertStockScore(sym, score, factors);
  return { symbol: sym, score, factors };
}
