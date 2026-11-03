export type ProviderId = 'FINNHUB' | 'BINANCE' | 'YAHOO';

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '1d' | '1w';

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '1d': 86_400,
  '1w': 604_800,
};

/** Times are unix seconds at the candle's open. */
export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

/** Unix seconds, inclusive. */
export type DateRange = { from: number; to: number };

export type ProviderQuote = {
  price: number;
  change?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
  /** When the provider says the price was set, as ISO. Missing if the provider doesn't say. */
  sourceTimestamp?: string;
};

export interface MarketDataProvider {
  readonly id: ProviderId;
  /** Null when the provider has no data for the symbol. Throws ProviderError when the request fails. */
  getQuote(symbol: string): Promise<ProviderQuote | null>;
  /** Empty when the provider has no data. Oldest candle first. */
  getCandles(symbol: string, timeframe: Timeframe, range: DateRange): Promise<Candle[]>;
}

export class ProviderError extends Error {
  constructor(
    readonly provider: ProviderId,
    message: string,
    readonly status?: number
  ) {
    super(`${provider}: ${message}`);
    this.name = 'ProviderError';
  }

  /** 401 and 403 mean the plan doesn't include this data, so retrying soon is pointless. */
  get notEntitled() {
    return this.status === 401 || this.status === 403;
  }

  get rateLimited() {
    return this.status === 429;
  }
}

const finite = (value: unknown): number | undefined => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};

export const toNumber = finite;

/** Fetches JSON and turns transport and HTTP failures into ProviderError. */
export async function fetchProviderJson<T>(
  provider: ProviderId,
  url: string,
  init: RequestInit & { next?: { revalidate?: number } } = {}
): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(8_000) });
  } catch (err) {
    throw new ProviderError(provider, err instanceof Error ? err.message : 'request failed');
  }
  // Unknown symbol, not an outage
  if (res.status === 404) return null;
  if (!res.ok) throw new ProviderError(provider, `HTTP ${res.status}`, res.status);
  try {
    return (await res.json()) as T;
  } catch {
    throw new ProviderError(provider, 'invalid JSON', res.status);
  }
}
