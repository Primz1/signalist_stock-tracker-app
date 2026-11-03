import { isCryptoSymbol, normalizeMarketSymbol } from '../symbols';
import {
  fetchProviderJson,
  ProviderError,
  toNumber,
  type Candle,
  type DateRange,
  type MarketDataProvider,
  type ProviderQuote,
  type Timeframe,
} from './types';

const BASE = 'https://finnhub.io/api/v1';

const RESOLUTIONS: Record<Timeframe, string> = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '1d': 'D', '1w': 'W' };

// Server-only key. NEXT_PUBLIC_ keys end up in browser bundles.
const token = () => process.env.FINNHUB_API_KEY ?? '';

export type FinnhubNewsItem = {
  id?: number;
  headline?: string;
  summary?: string;
  source?: string;
  url?: string;
  /** Unix seconds. */
  datetime?: number;
  related?: string;
  category?: string;
};

type FinnhubQuote = { c?: number; d?: number; dp?: number; h?: number; l?: number; o?: number; pc?: number; t?: number };
type FinnhubCandles = { s?: string; t?: number[]; o?: number[]; h?: number[]; l?: number[]; c?: number[]; v?: number[] };

const finnhubSymbol = (symbol: string) => {
  const s = normalizeMarketSymbol(symbol);
  return isCryptoSymbol(s) ? `BINANCE:${s}` : s;
};

export class FinnhubProvider implements MarketDataProvider {
  readonly id = 'FINNHUB' as const;

  private url(path: string, params: Record<string, string | number>) {
    const key = token();
    if (!key) throw new ProviderError(this.id, 'FINNHUB_API_KEY is not set');
    const query = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), token: key });
    return `${BASE}${path}?${query}`;
  }

  async getQuote(symbol: string): Promise<ProviderQuote | null> {
    const data = await fetchProviderJson<FinnhubQuote>(this.id, this.url('/quote', { symbol: finnhubSymbol(symbol) }), {
      next: { revalidate: 15 },
    });
    const price = toNumber(data?.c);
    // Finnhub answers unknown symbols with zeros rather than an error
    if (!data || !price) return null;
    return {
      price,
      change: toNumber(data.d),
      changePercent: toNumber(data.dp),
      open: toNumber(data.o),
      high: toNumber(data.h),
      low: toNumber(data.l),
      previousClose: toNumber(data.pc),
      sourceTimestamp: data.t ? new Date(data.t * 1000).toISOString() : undefined,
    };
  }

  /** Name, exchange and Finnhub's industry label. Null for ETFs and unknown symbols, which have no profile. */
  async getProfile(symbol: string): Promise<{ name: string; exchange?: string; industry?: string; currency?: string } | null> {
    const data = await fetchProviderJson<{ name?: string; exchange?: string; finnhubIndustry?: string; currency?: string }>(
      this.id,
      this.url('/stock/profile2', { symbol: normalizeMarketSymbol(symbol) }),
      { next: { revalidate: 86_400 } }
    );
    if (!data?.name) return null;
    return { name: data.name, exchange: data.exchange, industry: data.finnhubIndustry, currency: data.currency };
  }

  /** Company news between two dates (YYYY-MM-DD), newest first. */
  async getCompanyNews(symbol: string, from: string, to: string): Promise<FinnhubNewsItem[]> {
    const data = await fetchProviderJson<FinnhubNewsItem[]>(
      this.id,
      this.url('/company-news', { symbol: normalizeMarketSymbol(symbol), from, to }),
      { next: { revalidate: 300 } }
    );
    return Array.isArray(data) ? data : [];
  }

  /** General market news by category, e.g. 'general' or 'crypto'. */
  async getMarketNews(category: 'general' | 'crypto'): Promise<FinnhubNewsItem[]> {
    const data = await fetchProviderJson<FinnhubNewsItem[]>(this.id, this.url('/news', { category }), {
      next: { revalidate: 300 },
    });
    return Array.isArray(data) ? data : [];
  }

  /** Market cap in USD millions and P/E. Stocks only, cached for an hour because it changes slowly. */
  async getFundamentals(symbol: string): Promise<{ marketCap?: number; peRatio?: number } | null> {
    const sym = normalizeMarketSymbol(symbol);
    const [profile, metric] = await Promise.all([
      fetchProviderJson<{ marketCapitalization?: number }>(this.id, this.url('/stock/profile2', { symbol: sym }), {
        next: { revalidate: 3600 },
      }),
      fetchProviderJson<{ metric?: { peNormalizedAnnual?: number } }>(
        this.id,
        this.url('/stock/metric', { symbol: sym, metric: 'all' }),
        { next: { revalidate: 3600 } }
      ),
    ]);
    if (!profile && !metric) return null;
    return { marketCap: toNumber(profile?.marketCapitalization), peRatio: toNumber(metric?.metric?.peNormalizedAnnual) };
  }

  async getCandles(symbol: string, timeframe: Timeframe, range: DateRange): Promise<Candle[]> {
    const data = await fetchProviderJson<FinnhubCandles>(
      this.id,
      this.url('/stock/candle', { symbol: finnhubSymbol(symbol), resolution: RESOLUTIONS[timeframe], from: range.from, to: range.to }),
      { next: { revalidate: 60 } }
    );
    if (!data || data.s !== 'ok' || !data.t?.length) return [];
    const candles: Candle[] = [];
    data.t.forEach((time, i) => {
      const [open, high, low, close] = [data.o?.[i], data.h?.[i], data.l?.[i], data.c?.[i]].map(toNumber);
      if (open == null || high == null || low == null || close == null) return;
      candles.push({ time, open, high, low, close, volume: toNumber(data.v?.[i]) });
    });
    return candles;
  }
}
