import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BinanceProvider } from './binance';
import { FinnhubProvider } from './finnhub';
import { ProviderError } from './types';
import { YahooProvider } from './yahoo';

type Reply = { status?: number; body: unknown };

function stubFetch(replies: Record<string, Reply>) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      const match = Object.entries(replies).find(([fragment]) => url.includes(fragment));
      if (!match) throw new Error(`unexpected request ${url}`);
      const { status = 200, body } = match[1];
      return new Response(JSON.stringify(body), { status });
    })
  );
  return calls;
}

beforeEach(() => {
  vi.stubEnv('FINNHUB_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('FinnhubProvider', () => {
  it('parses a quote and keeps the provider timestamp', async () => {
    stubFetch({ '/quote': { body: { c: 215.88, d: 8.7, dp: 4.2, h: 216, l: 207, o: 207.5, pc: 207.18, t: 1793720969 } } });
    const quote = await new FinnhubProvider().getQuote('NVDA');
    expect(quote).toMatchObject({ price: 215.88, changePercent: 4.2, previousClose: 207.18 });
    expect(quote?.sourceTimestamp).toBe(new Date(1793720969 * 1000).toISOString());
  });

  it('treats the all-zero reply for unknown symbols as no data', async () => {
    stubFetch({ '/quote': { body: { c: 0, d: null, dp: null } } });
    expect(await new FinnhubProvider().getQuote('ZZZZ')).toBeNull();
  });

  it('marks 403 on candles as a plan limitation', async () => {
    stubFetch({ '/stock/candle': { status: 403, body: { error: 'no access' } } });
    const err = await new FinnhubProvider().getCandles('NVDA', '1m', { from: 0, to: 60 }).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.notEntitled).toBe(true);
  });

  it('asks crypto pairs with the exchange prefix', async () => {
    const calls = stubFetch({ '/quote': { body: { c: 77000, dp: 1 } } });
    await new FinnhubProvider().getQuote('BTCUSDT');
    expect(calls[0]).toContain('symbol=BINANCE%3ABTCUSDT');
  });

  it('never uses the browser-exposed key', async () => {
    vi.stubEnv('FINNHUB_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_FINNHUB_API_KEY', 'public-key');
    await expect(new FinnhubProvider().getQuote('NVDA')).rejects.toThrow('FINNHUB_API_KEY is not set');
  });
});

describe('BinanceProvider', () => {
  it('parses klines oldest first in seconds', async () => {
    stubFetch({
      '/klines': {
        body: [
          [1793665020000, '76906.01', '76952.83', '76906.00', '76952.02', '4.35'],
          [1793665080000, '76952.02', '76990.00', '76940.00', '76980.10', '3.10'],
        ],
      },
    });
    const candles = await new BinanceProvider().getCandles('BTCUSDT', '1m', { from: 0, to: 1 });
    expect(candles).toEqual([
      { time: 1793665020, open: 76906.01, high: 76952.83, low: 76906, close: 76952.02, volume: 4.35 },
      { time: 1793665080, open: 76952.02, high: 76990, low: 76940, close: 76980.1, volume: 3.1 },
    ]);
  });

  it('asks for the newest 1,000 candles when the range is longer', async () => {
    const calls = stubFetch({ '/klines': { body: [] } });
    const to = 2_000_000_000;
    await new BinanceProvider().getCandles('BTCUSDT', '1m', { from: to - 86_400, to });
    const startTime = Number(new URL(calls[0]).searchParams.get('startTime'));
    expect(startTime).toBe((to - 1000 * 60) * 1000);
  });

  it('returns no quote for an unlisted pair instead of throwing', async () => {
    stubFetch({ '/ticker/24hr': { status: 400, body: { code: -1121 } } });
    expect(await new BinanceProvider().getQuote('NOPEUSDT')).toBeNull();
  });

  it('maps batch tickers back to the requested symbols', async () => {
    stubFetch({
      '/ticker/24hr?symbols=': {
        body: [
          { symbol: 'BTCUSDT', lastPrice: '77618.71', priceChangePercent: '-0.31' },
          { symbol: 'ETHUSDT', lastPrice: '3412.5', priceChangePercent: '0.44' },
        ],
      },
    });
    const quotes = await new BinanceProvider().getQuotes(['BTCUSD', 'ETHUSDT']);
    expect(quotes.get('BTCUSD')?.price).toBe(77618.71);
    expect(quotes.get('ETHUSDT')?.changePercent).toBe(0.44);
  });
});

describe('YahooProvider', () => {
  it('computes change from the previous close it reports', async () => {
    stubFetch({
      '/v8/finance/chart/NVDA': {
        body: { chart: { result: [{ meta: { regularMarketPrice: 207.72, chartPreviousClose: 202.06, regularMarketTime: 1793720969 } }] } },
      },
    });
    const quote = await new YahooProvider().getQuote('NVDA');
    expect(quote?.price).toBe(207.72);
    expect(quote?.change).toBeCloseTo(5.66, 6);
    expect(quote?.changePercent).toBeCloseTo((5.66 / 202.06) * 100, 6);
  });

  it('skips bars with missing prices', async () => {
    stubFetch({
      '/v8/finance/chart/': {
        body: {
          chart: {
            result: [
              {
                timestamp: [1, 2, 3],
                indicators: { quote: [{ open: [1, null, 3], high: [1, 2, 3], low: [1, 2, 3], close: [1, 2, 3], volume: [10, 20, null] }] },
              },
            ],
          },
        },
      },
    });
    const candles = await new YahooProvider().getCandles('NVDA', '1m', { from: 0, to: 4 });
    expect(candles.map((c) => c.time)).toEqual([1, 3]);
    expect(candles[1].volume).toBeUndefined();
  });

  it('has nothing for crypto crosses it does not list', async () => {
    const calls = stubFetch({});
    expect(await new YahooProvider().getQuote('ETHBTC')).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
