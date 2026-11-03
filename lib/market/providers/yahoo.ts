import { isCryptoSymbol, normalizeMarketSymbol, yahooCryptoSymbol } from '../symbols';
import {
  fetchProviderJson,
  toNumber,
  type Candle,
  type DateRange,
  type MarketDataProvider,
  type ProviderQuote,
  type Timeframe,
} from './types';

const CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';

const INTERVALS: Record<Timeframe, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '60m', '1d': '1d', '1w': '1wk' };

// Yahoo rejects requests without a browser user agent
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketVolume?: number;
        regularMarketTime?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
  };
};

/** Null for crypto pairs Yahoo doesn't list. */
const yahooTicker = (symbol: string) => (isCryptoSymbol(symbol) ? yahooCryptoSymbol(symbol) : normalizeMarketSymbol(symbol));

export class YahooProvider implements MarketDataProvider {
  readonly id = 'YAHOO' as const;

  async getQuote(symbol: string): Promise<ProviderQuote | null> {
    const ticker = yahooTicker(symbol);
    if (!ticker) return null;
    const data = await fetchProviderJson<YahooChart>(this.id, `${CHART}/${encodeURIComponent(ticker)}?range=1d&interval=1d`, {
      headers: HEADERS,
      next: { revalidate: 15 },
    });
    const meta = data?.chart?.result?.[0]?.meta;
    const price = toNumber(meta?.regularMarketPrice);
    if (!meta || price == null) return null;

    const previousClose = toNumber(meta.chartPreviousClose ?? meta.previousClose);
    const change = previousClose != null ? price - previousClose : undefined;
    return {
      price,
      change,
      changePercent: change != null && previousClose ? (change / previousClose) * 100 : undefined,
      high: toNumber(meta.regularMarketDayHigh),
      low: toNumber(meta.regularMarketDayLow),
      previousClose,
      volume: toNumber(meta.regularMarketVolume),
      sourceTimestamp: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : undefined,
    };
  }

  async getCandles(symbol: string, timeframe: Timeframe, range: DateRange): Promise<Candle[]> {
    const ticker = yahooTicker(symbol);
    if (!ticker) return [];
    const params = new URLSearchParams({
      period1: String(range.from),
      period2: String(range.to),
      interval: INTERVALS[timeframe],
      includePrePost: 'false',
    });
    const data = await fetchProviderJson<YahooChart>(this.id, `${CHART}/${encodeURIComponent(ticker)}?${params}`, {
      headers: HEADERS,
      // Daily and weekly bars barely change within a session
      next: { revalidate: timeframe === '1d' || timeframe === '1w' ? 900 : 30 },
    });
    const result = data?.chart?.result?.[0];
    const times = result?.timestamp;
    const quote = result?.indicators?.quote?.[0];
    if (!times?.length || !quote) return [];

    const candles: Candle[] = [];
    times.forEach((time, i) => {
      const [open, high, low, close] = [quote.open?.[i], quote.high?.[i], quote.low?.[i], quote.close?.[i]].map(toNumber);
      if (open == null || high == null || low == null || close == null) return;
      candles.push({ time, open, high, low, close, volume: toNumber(quote.volume?.[i]) });
    });
    return candles;
  }
}
