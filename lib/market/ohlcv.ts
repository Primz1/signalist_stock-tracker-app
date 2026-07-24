const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';
const BINANCE_KLINES = 'https://data-api.binance.vision/api/v3/klines';
const BINANCE_TICKER = 'https://data-api.binance.vision/api/v3/ticker/24hr';

const YAHOO_CRYPTO_BASES = new Set([
  'BTC',
  'ETH',
  'BNB',
  'XRP',
  'ADA',
  'SOL',
  'DOGE',
  'DOT',
  'AVAX',
  'MATIC',
  'LINK',
  'LTC',
  'ATOM',
  'UNI',
  'NEAR',
]);

export function normalizeMarketSymbol(symbol: string): string {
  const s = symbol.toUpperCase().trim();
  return s.startsWith('BINANCE:') ? s.slice('BINANCE:'.length) : s;
}

export function isCryptoSymbol(symbol: string): boolean {
  const raw = symbol.toUpperCase().trim();
  if (raw.startsWith('BINANCE:')) return true;
  const s = normalizeMarketSymbol(raw);
  return /USDT$|USDC$|USD$|BTC$|ETH$|BNB$/i.test(s) && s.length >= 5;
}

/** Map BTCUSDT → BTC-USD; null for cross pairs Yahoo cannot serve. */
export function yahooCryptoSymbol(symbol: string): string | null {
  const s = normalizeMarketSymbol(symbol);
  const m = s.match(/^(.*?)(USDT|USDC|USD|BTC|ETH|BNB)$/i);
  if (!m) return null;
  const base = m[1];
  const quote = m[2].toUpperCase();
  if (!base || quote === 'BTC' || quote === 'ETH' || quote === 'BNB') return null;
  if (quote !== 'USDT' && quote !== 'USDC' && quote !== 'USD') return null;
  if (!YAHOO_CRYPTO_BASES.has(base) && base.length > 5) return null;
  return `${base}-USD`;
}

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type ChartRange = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'ALL';

export type OhlcvOptions = {
  resolution?: string;
  days?: number;
  from?: number;
  to?: number;
  /** Preferred when using Yahoo fallback */
  range?: ChartRange;
};

type FinnhubCandleResponse = {
  c?: number[];
  h?: number[];
  l?: number[];
  o?: number[];
  t?: number[];
  v?: number[];
  s?: string;
  error?: string;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
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
    error?: { description?: string } | null;
  };
};

export const CHART_RANGES: ChartRange[] = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y', 'ALL'];

/** Map UI range → Finnhub resolution + lookback days. */
export function rangeToOhlcvParams(range: ChartRange): { resolution: string; days: number } {
  switch (range) {
    case '1D':
      return { resolution: '15', days: 2 };
    case '5D':
      return { resolution: '60', days: 7 };
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

/** Map UI range → Yahoo chart range + interval. */
export function rangeToYahooParams(range: ChartRange): { range: string; interval: string } {
  switch (range) {
    case '1D':
      return { range: '1d', interval: '15m' };
    case '5D':
      return { range: '5d', interval: '60m' };
    case '1M':
      return { range: '1mo', interval: '1d' };
    case '3M':
      return { range: '3mo', interval: '1d' };
    case '6M':
      return { range: '6mo', interval: '1d' };
    case '1Y':
      return { range: '1y', interval: '1d' };
    case '5Y':
      return { range: '5y', interval: '1wk' };
    case 'ALL':
      return { range: 'max', interval: '1wk' };
    default:
      return { range: '3mo', interval: '1d' };
  }
}

function parseOhlcvArgs(
  daysOrOpts?: number | OhlcvOptions
): { resolution: string; from: number; to: number; range?: ChartRange } {
  const to = Math.floor(Date.now() / 1000);
  if (typeof daysOrOpts === 'number' || daysOrOpts == null) {
    const days = typeof daysOrOpts === 'number' ? daysOrOpts : 90;
    return { resolution: 'D', from: to - days * 24 * 60 * 60, to };
  }
  const resolution = daysOrOpts.resolution ?? 'D';
  if (daysOrOpts.from != null && daysOrOpts.to != null) {
    return { resolution, from: daysOrOpts.from, to: daysOrOpts.to, range: daysOrOpts.range };
  }
  const days = daysOrOpts.days ?? 90;
  return {
    resolution,
    from: to - days * 24 * 60 * 60,
    to,
    range: daysOrOpts.range,
  };
}

function inferChartRange(days: number, resolution: string): ChartRange {
  if (resolution === '15' || resolution === '5') return '1D';
  if (resolution === '60' || resolution === '30') return '5D';
  if (resolution === 'W' || resolution === 'M') {
    return days > 365 * 6 ? 'ALL' : '5Y';
  }
  if (days <= 40) return '1M';
  if (days <= 100) return '3M';
  if (days <= 200) return '6M';
  if (days <= 400) return '1Y';
  return 'ALL';
}

async function fetchOhlcvFinnhub(
  symbol: string,
  resolution: string,
  from: number,
  to: number
): Promise<Candle[]> {
  const token = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
  if (!token) return [];

  const url = `${FINNHUB_BASE}/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${encodeURIComponent(resolution)}&from=${from}&to=${to}&token=${token}`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 60, tags: [`ohlcv-fh-${symbol}-${resolution}`] },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as FinnhubCandleResponse;
    if (data.s !== 'ok' || !data.t?.length) return [];

    return data.t.map((time, i) => ({
      time,
      open: data.o![i],
      high: data.h![i],
      low: data.l![i],
      close: data.c![i],
      volume: data.v?.[i],
    }));
  } catch {
    return [];
  }
}

async function fetchOhlcvBinance(
  symbol: string,
  lookbackDays: number
): Promise<Candle[]> {
  const sym = normalizeMarketSymbol(symbol);
  const limit = Math.max(25, Math.min(1000, lookbackDays + 10));
  try {
    const url = `${BINANCE_KLINES}?symbol=${encodeURIComponent(sym)}&interval=1d&limit=${limit}`;
    const res = await fetch(url, {
      next: { revalidate: 60, tags: [`ohlcv-binance-${sym}`] },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as unknown[];
    if (!Array.isArray(rows) || !rows.length) return [];
    const candles: Candle[] = [];
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 6) continue;
      const open = Number(row[1]);
      const high = Number(row[2]);
      const low = Number(row[3]);
      const close = Number(row[4]);
      const volume = Number(row[5]);
      const time = Math.floor(Number(row[0]) / 1000);
      if (![open, high, low, close, time].every(Number.isFinite)) continue;
      candles.push({
        time,
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volume) ? volume : undefined,
      });
    }
    return candles;
  } catch {
    return [];
  }
}

export async function fetchOhlcvYahoo(
  symbol: string,
  chartRange: ChartRange = '3M'
): Promise<Candle[]> {
  const { range, interval } = rangeToYahooParams(chartRange);
  const yahooSym =
    isCryptoSymbol(symbol) ? yahooCryptoSymbol(symbol) : null;
  const ticker = yahooSym || normalizeMarketSymbol(symbol);
  const url = `${YAHOO_CHART}/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&includePrePost=false`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      next: { revalidate: 60, tags: [`ohlcv-yahoo-${ticker}-${chartRange}`] },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as YahooChartResponse;
    const result = data.chart?.result?.[0];
    const times = result?.timestamp;
    const quote = result?.indicators?.quote?.[0];
    if (!times?.length || !quote) return [];

    const candles: Candle[] = [];
    for (let i = 0; i < times.length; i++) {
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
      if (
        open == null ||
        high == null ||
        low == null ||
        close == null ||
        !Number.isFinite(open) ||
        !Number.isFinite(high) ||
        !Number.isFinite(low) ||
        !Number.isFinite(close)
      ) {
        continue;
      }
      const vol = quote.volume?.[i];
      candles.push({
        time: times[i],
        open,
        high,
        low,
        close,
        volume: vol != null && Number.isFinite(vol) ? vol : undefined,
      });
    }
    return candles;
  } catch {
    return [];
  }
}

export async function fetchOhlcv(
  symbol: string,
  daysOrOpts: number | OhlcvOptions = 90
): Promise<Candle[]> {
  const { resolution, from, to, range } = parseOhlcvArgs(daysOrOpts);
  const chartRange =
    range ??
    (typeof daysOrOpts === 'object' && daysOrOpts?.range
      ? daysOrOpts.range
      : inferChartRange(
          typeof daysOrOpts === 'number' ? daysOrOpts : daysOrOpts?.days ?? 90,
          resolution
        ));

  const sym = normalizeMarketSymbol(symbol);
  const finnhub = await fetchOhlcvFinnhub(sym, resolution, from, to);
  if (finnhub.length) return finnhub;

  // Finnhub stock/candle is paid on many plans — Yahoo keeps charts working
  const yahoo = await fetchOhlcvYahoo(sym, chartRange);
  if (yahoo.length) return yahoo;

  if (isCryptoSymbol(sym)) {
    const days =
      typeof daysOrOpts === 'number'
        ? daysOrOpts
        : daysOrOpts?.days ?? 90;
    return fetchOhlcvBinance(sym, days);
  }
  return [];
}

export type Quote = {
  price: number;
  changePercent: number;
  change?: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
};

async function fetchQuoteBinance(symbol: string): Promise<Quote | null> {
  const sym = normalizeMarketSymbol(symbol);
  try {
    const res = await fetch(`${BINANCE_TICKER}?symbol=${encodeURIComponent(sym)}`, {
      next: { revalidate: 20 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const price = Number(data.lastPrice);
    const changePercent = Number(data.priceChangePercent);
    const change = Number(data.priceChange);
    if (!Number.isFinite(price)) return null;
    return {
      price,
      changePercent: Number.isFinite(changePercent) ? changePercent : 0,
      change: Number.isFinite(change) ? change : undefined,
      high: Number.isFinite(Number(data.highPrice)) ? Number(data.highPrice) : undefined,
      low: Number.isFinite(Number(data.lowPrice)) ? Number(data.lowPrice) : undefined,
      open: Number.isFinite(Number(data.openPrice)) ? Number(data.openPrice) : undefined,
      volume: Number.isFinite(Number(data.volume)) ? Number(data.volume) : undefined,
    };
  } catch {
    return null;
  }
}

export async function fetchQuote(symbol: string): Promise<Quote | null> {
  const sym = normalizeMarketSymbol(symbol);
  if (isCryptoSymbol(sym)) {
    const binance = await fetchQuoteBinance(sym);
    if (binance) return binance;
  }

  const token = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
  if (!token) return null;
  const finnhubSym = isCryptoSymbol(sym) ? `BINANCE:${sym}` : sym;
  const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(finnhubSym)}&token=${token}`;
  try {
    const res = await fetch(url, { next: { revalidate: 20 } });
    if (!res.ok) return null;
    const data = await res.json();
    const price = typeof data.c === 'number' ? data.c : 0;
    if (!price) {
      if (isCryptoSymbol(sym)) return fetchQuoteBinance(sym);
      return null;
    }
    return {
      price,
      changePercent: typeof data.dp === 'number' ? data.dp : 0,
      change: typeof data.d === 'number' ? data.d : undefined,
      open: typeof data.o === 'number' ? data.o : undefined,
      high: typeof data.h === 'number' ? data.h : undefined,
      low: typeof data.l === 'number' ? data.l : undefined,
      previousClose: typeof data.pc === 'number' ? data.pc : undefined,
      volume: typeof data.v === 'number' ? data.v : undefined,
    };
  } catch {
    return isCryptoSymbol(sym) ? fetchQuoteBinance(sym) : null;
  }
}
