'use server';

import { cache } from 'react';
import {
  fetchOhlcv,
  fetchQuote,
  rangeToOhlcvParams,
  type ChartRange,
} from '@/lib/market/ohlcv';
import { computeIndicators, deriveSignals } from '@/lib/market/indicators';
import { connectToDatabase } from '@/database/mongoose';
import { upsertMarketSnapshot } from '@/database/models/marketSnapshot.model';

async function loadChartData(symbol: string, range: ChartRange = '3M') {
  const sym = symbol.toUpperCase();
  const selected = (range || '3M') as ChartRange;
  const params = rangeToOhlcvParams(selected);

  let [candles, quote] = await Promise.all([
    fetchOhlcv(sym, { resolution: params.resolution, days: params.days, range: selected }),
    fetchQuote(sym),
  ]);

  if (!candles.length && (selected === '1D' || selected === '5D')) {
    candles = await fetchOhlcv(sym, {
      resolution: 'D',
      days: selected === '1D' ? 30 : 60,
      range: '1M',
    });
  }

  if (!candles.length) {
    return {
      symbol: sym,
      range: selected,
      candles: [],
      quote,
      indicators: null,
      signals: [] as ReturnType<typeof deriveSignals>,
    };
  }

  if (quote && quote.volume == null) {
    const lastVol = candles[candles.length - 1]?.volume;
    if (lastVol != null) quote = { ...quote, volume: lastVol };
  }

  let indicatorCandles = candles;
  if (selected === '1D' || selected === '5D' || selected === '1M') {
    const daily = await fetchOhlcv(sym, { resolution: 'D', days: 370, range: '1Y' });
    if (daily.length >= 50) indicatorCandles = daily;
  }

  const indicators = computeIndicators(indicatorCandles);
  const signals = deriveSignals(indicators, candles);

  return {
    symbol: sym,
    range: selected,
    candles,
    quote,
    indicators,
    signals,
  };
}

/** Dedupes chart loads within a single React request (symbol+range). */
export const getChartData = cache(async (symbol: string, range: ChartRange = '3M') => {
  return loadChartData(symbol, range);
});

export async function saveMarketSnapshot(symbol: string) {
  const data = await loadChartData(symbol, '3M');
  if (!data.candles.length || !data.quote) return null;

  await connectToDatabase();
  return upsertMarketSnapshot({
    symbol: data.symbol,
    price: data.quote.price,
    volume: data.quote.volume,
    changePercent: data.quote.changePercent,
    ohlcv: data.candles.slice(-60),
    indicators: data.indicators
      ? {
          sma20: data.indicators.sma20,
          sma50: data.indicators.sma50,
          rsi14: data.indicators.rsi14,
          macd: data.indicators.macd,
          bollinger: data.indicators.bollinger,
        }
      : undefined,
    timestamp: new Date(),
  } as Parameters<typeof upsertMarketSnapshot>[0]);
}
