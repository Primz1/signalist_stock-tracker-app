/**
 * Chart-range helpers over MarketDataService. Vendor calls live in ./providers, so
 * nothing here talks to Finnhub, Binance or Yahoo directly.
 */
import { marketData, type Quote } from './service';
import type { Candle, Timeframe } from './providers/types';
import { isCryptoSymbol } from './symbols';

export { isCryptoSymbol, normalizeMarketSymbol, yahooCryptoSymbol } from './symbols';
export type { Candle } from './providers/types';
export type { Quote } from './service';

export type ChartRange = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'ALL';

export type OhlcvOptions = {
  resolution?: string;
  days?: number;
  from?: number;
  to?: number;
  range?: ChartRange;
};

export const CHART_RANGES: ChartRange[] = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y', 'ALL'];

/** Map UI range → resolution + lookback days. 1D and 5D look further back to cover weekends. */
export function rangeToOhlcvParams(range: ChartRange): { resolution: string; days: number } {
  switch (range) {
    case '1D':
      return { resolution: '15', days: 5 };
    case '5D':
      return { resolution: '60', days: 9 };
    case '1M':
      return { resolution: 'D', days: 35 };
    case '3M':
      return { resolution: 'D', days: 95 };
    case '6M':
      return { resolution: 'D', days: 190 };
    case '1Y':
      return { resolution: 'D', days: 370 };
    case '5Y':
      return { resolution: 'W', days: 365 * 5 + 14 };
    case 'ALL':
      return { resolution: 'W', days: 365 * 10 };
    default:
      return { resolution: 'D', days: 95 };
  }
}

const RESOLUTION_TIMEFRAMES: Record<string, Timeframe> = {
  '1': '1m',
  '5': '5m',
  '15': '15m',
  '30': '15m',
  '60': '1h',
  D: '1d',
  W: '1w',
  M: '1w',
};

const DAY_SECONDS = 24 * 60 * 60;

const newYorkDate = (unixSeconds: number) =>
  new Date(unixSeconds * 1000).toLocaleDateString('en-US', { timeZone: 'America/New_York' });

/** The most recent session: the last 24 hours for crypto, the last trading date for stocks. */
export function lastSession(symbol: string, candles: Candle[]): Candle[] {
  const last = candles.at(-1);
  if (!last) return candles;
  if (isCryptoSymbol(symbol)) return candles.filter((c) => c.time > last.time - DAY_SECONDS);
  const day = newYorkDate(last.time);
  return candles.filter((c) => newYorkDate(c.time) === day);
}

export async function fetchOhlcv(symbol: string, daysOrOpts: number | OhlcvOptions = 90): Promise<Candle[]> {
  const opts: OhlcvOptions = typeof daysOrOpts === 'number' ? { days: daysOrOpts } : daysOrOpts;
  const timeframe = RESOLUTION_TIMEFRAMES[opts.resolution ?? 'D'] ?? '1d';
  const to = opts.to ?? Math.floor(Date.now() / 1000);
  const from = opts.from ?? to - (opts.days ?? 90) * DAY_SECONDS;

  const { candles } = await marketData.getCandles(symbol, timeframe, { from, to });
  return opts.range === '1D' ? lastSession(symbol, candles) : candles;
}

export async function fetchQuote(symbol: string): Promise<Quote | null> {
  return marketData.getQuote(symbol);
}
