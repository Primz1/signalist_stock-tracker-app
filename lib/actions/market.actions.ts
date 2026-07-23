'use server';

import { fetchOhlcv, fetchQuote } from '@/lib/market/ohlcv';
import { computeIndicators, deriveSignals } from '@/lib/market/indicators';
import { connectToDatabase } from '@/database/mongoose';
import { upsertMarketSnapshot } from '@/database/models/marketSnapshot.model';

export async function getChartData(symbol: string) {
  const sym = symbol.toUpperCase();
  const [candles, quote] = await Promise.all([fetchOhlcv(sym), fetchQuote(sym)]);

  if (!candles.length) {
    return { symbol: sym, candles: [], quote, indicators: null, signals: [] };
  }

  const indicators = computeIndicators(candles);
  const signals = deriveSignals(indicators);

  return {
    symbol: sym,
    candles,
    quote,
    indicators: {
      sma20: indicators.sma20,
      sma50: indicators.sma50,
      rsi14: indicators.rsi14,
      macd: indicators.macd,
      bollinger: indicators.bollinger,
      series: indicators.series,
    },
    signals,
  };
}

export async function saveMarketSnapshot(symbol: string) {
  const data = await getChartData(symbol);
  if (!data.candles.length || !data.quote) return null;

  await connectToDatabase();
  return upsertMarketSnapshot({
    symbol: data.symbol,
    price: data.quote.price,
    volume: data.quote.volume,
    changePercent: data.quote.changePercent,
    ohlcv: data.candles.slice(-60),
    indicators: data.indicators ?? undefined,
    timestamp: new Date(),
  } as Parameters<typeof upsertMarketSnapshot>[0]);
}
