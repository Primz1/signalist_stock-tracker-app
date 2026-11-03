import { describe, expect, it, vi } from 'vitest';
import { MarketDataService } from './service';
import { ProviderError, type MarketDataProvider, type ProviderId, type ProviderQuote } from './providers/types';

vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

type FakeOptions = {
  quote?: (symbol: string) => Promise<ProviderQuote | null>;
  batch?: (symbols: string[]) => Promise<Map<string, ProviderQuote>>;
};

function fake(id: ProviderId, options: FakeOptions = {}) {
  const provider: MarketDataProvider & { getQuotes?: FakeOptions['batch'] } = {
    id,
    getQuote: vi.fn(options.quote ?? (async () => null)),
    getCandles: vi.fn(async () => []),
  };
  if (options.batch) provider.getQuotes = vi.fn(options.batch);
  return provider;
}

const quote = (price: number): ProviderQuote => ({ price, changePercent: 1 });

function build(providers: Partial<Record<ProviderId, MarketDataProvider>>, now = () => 1_000_000) {
  return new MarketDataService(
    { FINNHUB: fake('FINNHUB'), BINANCE: fake('BINANCE'), YAHOO: fake('YAHOO'), ...providers },
    now
  );
}

describe('MarketDataService', () => {
  it('uses the preferred provider and says so', async () => {
    const service = build({ FINNHUB: fake('FINNHUB', { quote: async () => quote(100) }) });
    const result = await service.getQuote('nvda');
    expect(result).toMatchObject({ symbol: 'NVDA', price: 100, source: 'FINNHUB', fallback: false });
  });

  it('falls back when the preferred provider fails, and records the fallback', async () => {
    const service = build({
      FINNHUB: fake('FINNHUB', { quote: async () => Promise.reject(new ProviderError('FINNHUB', 'down', 500)) }),
      YAHOO: fake('YAHOO', { quote: async () => quote(101) }),
    });
    const result = await service.getQuote('NVDA');
    expect(result).toMatchObject({ price: 101, source: 'YAHOO', fallback: true });
    expect(service.getHealth().find((h) => h.provider === 'FINNHUB')).toMatchObject({ consecutiveFailures: 1, lastError: 'FINNHUB: down' });
  });

  it('returns null rather than inventing a price when every provider fails', async () => {
    const failing = async () => Promise.reject(new ProviderError('YAHOO', 'down', 503));
    const service = build({ FINNHUB: fake('FINNHUB', { quote: failing }), YAHOO: fake('YAHOO', { quote: failing }) });
    expect(await service.getQuote('NVDA')).toBeNull();
  });

  it('stops asking a provider whose plan lacks the data, then retries after the backoff', async () => {
    let now = 0;
    const finnhub = fake('FINNHUB', { quote: async () => Promise.reject(new ProviderError('FINNHUB', 'forbidden', 403)) });
    const service = build({ FINNHUB: finnhub, YAHOO: fake('YAHOO', { quote: async () => quote(1) }) }, () => now);

    await service.getQuote('NVDA');
    await service.getQuote('AAPL');
    expect(finnhub.getQuote).toHaveBeenCalledTimes(1);

    now += 61 * 60 * 1000;
    await service.getQuote('MSFT');
    expect(finnhub.getQuote).toHaveBeenCalledTimes(2);
  });

  it('routes crypto to Binance first', async () => {
    const binance = fake('BINANCE', { quote: async () => quote(77000) });
    const finnhub = fake('FINNHUB', { quote: async () => quote(1) });
    const service = build({ BINANCE: binance, FINNHUB: finnhub });
    expect((await service.getQuote('BTCUSDT'))?.source).toBe('BINANCE');
    expect(finnhub.getQuote).not.toHaveBeenCalled();
  });

  it('quotes several crypto pairs in one batch request', async () => {
    const binance = fake('BINANCE', {
      batch: async (symbols) => new Map(symbols.map((s, i) => [s, quote(i + 1)])),
    });
    const service = build({ BINANCE: binance });
    const quotes = await service.getQuotes(['BTCUSDT', 'ETHUSDT', 'BTCUSDT']);
    expect(quotes.size).toBe(2);
    expect(binance.getQuotes).toHaveBeenCalledTimes(1);
    expect(binance.getQuote).not.toHaveBeenCalled();
  });

  it('falls back to single quotes when the batch fails', async () => {
    const binance = fake('BINANCE', {
      batch: async () => Promise.reject(new ProviderError('BINANCE', 'bad symbol', 400)),
      quote: async (s) => (s === 'BTCUSDT' ? quote(77000) : null),
    });
    const service = build({ BINANCE: binance });
    const quotes = await service.getQuotes(['BTCUSDT', 'NOPEUSDT']);
    expect([...quotes.keys()]).toEqual(['BTCUSDT']);
  });

  it('shares one request between concurrent callers', async () => {
    let resolve!: (q: ProviderQuote) => void;
    const finnhub = fake('FINNHUB', { quote: () => new Promise((r) => (resolve = r)) });
    const service = build({ FINNHUB: finnhub });
    const both = Promise.all([service.getQuote('NVDA'), service.getQuote('NVDA')]);
    resolve(quote(5));
    const [a, b] = await both;
    expect(a?.price).toBe(5);
    expect(b?.price).toBe(5);
    expect(finnhub.getQuote).toHaveBeenCalledTimes(1);
  });
});
