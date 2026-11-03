import { binanceSymbol } from '../symbols';
import {
  fetchProviderJson,
  TIMEFRAME_SECONDS,
  toNumber,
  type Candle,
  type DateRange,
  type MarketDataProvider,
  type ProviderQuote,
  type Timeframe,
} from './types';

// api.binance.com refuses US traffic, including Vercel's US regions. This mirror serves public market data.
const BASE = 'https://data-api.binance.vision/api/v3';
const MAX_KLINES = 1000;

type BinanceTicker = {
  symbol?: string;
  lastPrice?: string;
  priceChange?: string;
  priceChangePercent?: string;
  openPrice?: string;
  highPrice?: string;
  lowPrice?: string;
  prevClosePrice?: string;
  volume?: string;
  closeTime?: number;
};

function toQuote(ticker: BinanceTicker | null): ProviderQuote | null {
  const price = toNumber(ticker?.lastPrice);
  if (!ticker || price == null) return null;
  return {
    price,
    change: toNumber(ticker.priceChange),
    changePercent: toNumber(ticker.priceChangePercent),
    open: toNumber(ticker.openPrice),
    high: toNumber(ticker.highPrice),
    low: toNumber(ticker.lowPrice),
    previousClose: toNumber(ticker.prevClosePrice),
    volume: toNumber(ticker.volume),
    sourceTimestamp: ticker.closeTime ? new Date(ticker.closeTime).toISOString() : undefined,
  };
}

export class BinanceProvider implements MarketDataProvider {
  readonly id = 'BINANCE' as const;

  async getQuote(symbol: string): Promise<ProviderQuote | null> {
    const ticker = await fetchProviderJson<BinanceTicker>(
      this.id,
      `${BASE}/ticker/24hr?symbol=${encodeURIComponent(binanceSymbol(symbol))}`,
      { next: { revalidate: 10 } }
    ).catch((err) => {
      // Binance answers an unlisted symbol with 400
      if (err?.status === 400) return null;
      throw err;
    });
    return toQuote(ticker);
  }

  /** One request for many symbols. Fails as a whole if any symbol is unlisted, so callers fall back to single quotes. */
  async getQuotes(symbols: string[]): Promise<Map<string, ProviderQuote>> {
    const mapped = new Map(symbols.map((symbol) => [binanceSymbol(symbol), symbol]));
    const tickers = await fetchProviderJson<BinanceTicker[]>(
      this.id,
      `${BASE}/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify([...mapped.keys()]))}`,
      { next: { revalidate: 10 } }
    );
    const quotes = new Map<string, ProviderQuote>();
    for (const ticker of tickers ?? []) {
      const original = ticker.symbol ? mapped.get(ticker.symbol) : undefined;
      const quote = toQuote(ticker);
      if (original && quote) quotes.set(original, quote);
    }
    return quotes;
  }

  async getCandles(symbol: string, timeframe: Timeframe, range: DateRange): Promise<Candle[]> {
    // Binance counts its 1,000-candle limit from startTime, so a long range would
    // return the oldest candles. Keep the newest 1,000 instead.
    const from = Math.max(range.from, range.to - MAX_KLINES * TIMEFRAME_SECONDS[timeframe]);
    const params = new URLSearchParams({
      symbol: binanceSymbol(symbol),
      interval: timeframe,
      startTime: String(from * 1000),
      endTime: String(range.to * 1000),
      limit: String(MAX_KLINES),
    });
    const rows = await fetchProviderJson<unknown[]>(this.id, `${BASE}/klines?${params}`, { next: { revalidate: 30 } }).catch(
      (err) => {
        if (err?.status === 400) return null;
        throw err;
      }
    );
    if (!Array.isArray(rows)) return [];

    const candles: Candle[] = [];
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 6) continue;
      const [openTime, open, high, low, close, volume] = row.map(toNumber);
      if (openTime == null || open == null || high == null || low == null || close == null) continue;
      candles.push({ time: Math.floor(openTime / 1000), open, high, low, close, volume });
    }
    return candles;
  }
}
