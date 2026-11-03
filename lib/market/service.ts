import { logError } from '@/lib/logger';
import { BinanceProvider } from './providers/binance';
import { FinnhubProvider } from './providers/finnhub';
import {
  ProviderError,
  type Candle,
  type DateRange,
  type MarketDataProvider,
  type ProviderId,
  type ProviderQuote,
  type Timeframe,
} from './providers/types';
import { YahooProvider } from './providers/yahoo';
import { isCryptoSymbol, normalizeMarketSymbol } from './symbols';

export type Quote = ProviderQuote & {
  symbol: string;
  source: ProviderId;
  /** True when the preferred provider failed and a later one answered. */
  fallback: boolean;
  fetchedAt: string;
};

export type CandleSeries = {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  /** Null when no provider had data. */
  source: ProviderId | null;
  fallback: boolean;
  fetchedAt: string;
};

export type ProviderHealth = {
  provider: ProviderId;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
};

type Capability = 'quote' | 'candles';

// Finnhub's free plan has no candles, and Binance doesn't list stocks
const QUOTE_ORDER: Record<'crypto' | 'stock', ProviderId[]> = {
  crypto: ['BINANCE', 'FINNHUB', 'YAHOO'],
  stock: ['FINNHUB', 'YAHOO'],
};
const CANDLE_ORDER: Record<'crypto' | 'stock', ProviderId[]> = {
  crypto: ['BINANCE', 'YAHOO'],
  stock: ['YAHOO', 'FINNHUB'],
};

const NOT_ENTITLED_BACKOFF_MS = 60 * 60 * 1000;
const RATE_LIMIT_BACKOFF_MS = 60 * 1000;
const QUOTE_CONCURRENCY = 8;

type BatchQuoteProvider = MarketDataProvider & { getQuotes(symbols: string[]): Promise<Map<string, ProviderQuote>> };

const supportsBatch = (provider: MarketDataProvider): provider is BatchQuoteProvider =>
  typeof (provider as Partial<BatchQuoteProvider>).getQuotes === 'function';

/**
 * The only way the app reads quotes and candles. Each request walks the provider order
 * for the asset class and records which provider answered.
 */
export class MarketDataService {
  private readonly health = new Map<ProviderId, ProviderHealth>();
  private readonly skipUntil = new Map<string, number>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly providers: Record<ProviderId, MarketDataProvider>,
    private readonly now: () => number = Date.now
  ) {}

  async getQuote(symbol: string): Promise<Quote | null> {
    const sym = normalizeMarketSymbol(symbol);
    return this.once(`quote:${sym}`, async () => {
      const order = QUOTE_ORDER[isCryptoSymbol(sym) ? 'crypto' : 'stock'];
      const hit = await this.firstAnswer(order, 'quote', sym, (p) => p.getQuote(sym));
      return hit ? { ...hit.value, symbol: sym, source: hit.provider, fallback: hit.fallback, fetchedAt: this.iso() } : null;
    });
  }

  /** Quotes for many symbols. Crypto goes through Binance's batch endpoint in one request. */
  async getQuotes(symbols: string[]): Promise<Map<string, Quote>> {
    const unique = Array.from(new Set(symbols.map(normalizeMarketSymbol)));
    const results = new Map<string, Quote>();

    const crypto = unique.filter(isCryptoSymbol);
    const binance = this.providers.BINANCE;
    if (crypto.length > 1 && supportsBatch(binance) && this.available('BINANCE', 'quote')) {
      try {
        const batch = await binance.getQuotes(crypto);
        this.recordSuccess('BINANCE');
        batch.forEach((quote, sym) =>
          results.set(sym, { ...quote, symbol: sym, source: 'BINANCE', fallback: false, fetchedAt: this.iso() })
        );
      } catch (err) {
        // One unlisted pair fails the batch. Single quotes below still try each one.
        this.recordFailure('BINANCE', 'quote', err);
      }
    }

    const remaining = unique.filter((sym) => !results.has(sym));
    for (let i = 0; i < remaining.length; i += QUOTE_CONCURRENCY) {
      const chunk = remaining.slice(i, i + QUOTE_CONCURRENCY);
      const quotes = await Promise.all(chunk.map((sym) => this.getQuote(sym)));
      quotes.forEach((quote, j) => quote && results.set(chunk[j], quote));
    }
    return results;
  }

  async getCandles(symbol: string, timeframe: Timeframe, range: DateRange): Promise<CandleSeries> {
    const sym = normalizeMarketSymbol(symbol);
    return this.once(`candles:${sym}:${timeframe}:${range.from}:${range.to}`, async () => {
      const order = CANDLE_ORDER[isCryptoSymbol(sym) ? 'crypto' : 'stock'];
      const hit = await this.firstAnswer(order, 'candles', sym, async (p) => {
        const candles = await p.getCandles(sym, timeframe, range);
        return candles.length ? candles : null;
      });
      return {
        symbol: sym,
        timeframe,
        candles: hit?.value ?? [],
        source: hit?.provider ?? null,
        fallback: hit?.fallback ?? false,
        fetchedAt: this.iso(),
      };
    });
  }

  async getProfile(symbol: string) {
    const sym = normalizeMarketSymbol(symbol);
    const finnhub = this.providers.FINNHUB;
    if (isCryptoSymbol(sym) || !(finnhub instanceof FinnhubProvider)) return null;
    try {
      const result = await finnhub.getProfile(sym);
      this.recordSuccess('FINNHUB');
      return result;
    } catch (err) {
      this.recordFailure('FINNHUB', 'quote', err, sym);
      return null;
    }
  }

  /** Slow-moving company data. Only Finnhub has it, and only for stocks. */
  async getFundamentals(symbol: string): Promise<{ marketCap?: number; peRatio?: number } | null> {
    const sym = normalizeMarketSymbol(symbol);
    const finnhub = this.providers.FINNHUB;
    if (isCryptoSymbol(sym) || !(finnhub instanceof FinnhubProvider)) return null;
    try {
      const result = await finnhub.getFundamentals(sym);
      this.recordSuccess('FINNHUB');
      return result;
    } catch (err) {
      this.recordFailure('FINNHUB', 'quote', err, sym);
      return null;
    }
  }

  getHealth(): ProviderHealth[] {
    return (Object.keys(this.providers) as ProviderId[]).map(
      (provider) =>
        this.health.get(provider) ?? {
          provider,
          lastSuccessAt: null,
          lastFailureAt: null,
          lastError: null,
          consecutiveFailures: 0,
        }
    );
  }

  private async firstAnswer<T>(
    order: ProviderId[],
    capability: Capability,
    symbol: string,
    ask: (provider: MarketDataProvider) => Promise<T | null>
  ): Promise<{ value: T; provider: ProviderId; fallback: boolean } | null> {
    let tried = 0;
    for (const id of order) {
      if (!this.available(id, capability)) continue;
      tried += 1;
      try {
        const value = await ask(this.providers[id]);
        this.recordSuccess(id);
        // Having no data is a valid answer, but a later provider may still have it
        if (value != null) return { value, provider: id, fallback: tried > 1 || id !== order[0] };
      } catch (err) {
        this.recordFailure(id, capability, err, symbol);
      }
    }
    return null;
  }

  private available(id: ProviderId, capability: Capability) {
    return (this.skipUntil.get(`${id}:${capability}`) ?? 0) <= this.now();
  }

  private recordSuccess(provider: ProviderId) {
    const current = this.getHealth().find((h) => h.provider === provider)!;
    this.health.set(provider, { ...current, lastSuccessAt: this.iso(), consecutiveFailures: 0 });
  }

  private recordFailure(provider: ProviderId, capability: Capability, err: unknown, symbol?: string) {
    const message = err instanceof Error ? err.message : String(err);
    const current = this.getHealth().find((h) => h.provider === provider)!;
    this.health.set(provider, {
      ...current,
      lastFailureAt: this.iso(),
      lastError: message,
      consecutiveFailures: current.consecutiveFailures + 1,
    });

    if (err instanceof ProviderError && (err.notEntitled || err.rateLimited)) {
      const backoff = err.notEntitled ? NOT_ENTITLED_BACKOFF_MS : RATE_LIMIT_BACKOFF_MS;
      this.skipUntil.set(`${provider}:${capability}`, this.now() + backoff);
    }
    logError('market data provider failed', { provider, capability, symbol, error: message });
  }

  /** Concurrent callers asking for the same thing share one request. */
  private once<T>(key: string, run: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const promise = run().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }

  private iso() {
    return new Date(this.now()).toISOString();
  }
}

export const marketData = new MarketDataService({
  FINNHUB: new FinnhubProvider(),
  BINANCE: new BinanceProvider(),
  YAHOO: new YahooProvider(),
});
