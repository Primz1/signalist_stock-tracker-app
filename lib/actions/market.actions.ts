'use server';

import { cache } from 'react';
import {
  fetchOhlcv,
  fetchQuote,
  rangeToOhlcvParams,
  type ChartRange,
} from '@/lib/market/ohlcv';
import { computeIndicators, deriveSignals } from '@/lib/market/indicators';
import type { ProviderId, ProviderQuote } from '@/lib/market/providers/types';

/** Source fields are absent only for demo data on /preview. */
export type ChartQuote = ProviderQuote & { source?: ProviderId; fetchedAt?: string };

async function loadChartData(symbol: string, range: ChartRange = '3M') {
  const sym = symbol.toUpperCase();
  const selected = (range || '3M') as ChartRange;
  const params = rangeToOhlcvParams(selected);

  let [candles, quote]: [Awaited<ReturnType<typeof fetchOhlcv>>, ChartQuote | null] = await Promise.all([
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
