/** Symbol rules shared by every provider, so one asset is never crypto in one place and a stock in another. */

const CRYPTO_QUOTES = ['USDT', 'USDC', 'USD', 'BTC', 'ETH', 'BNB'] as const;

const YAHOO_CRYPTO_BASES = new Set([
  'BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'SOL', 'DOGE', 'DOT', 'AVAX', 'MATIC', 'LINK', 'LTC', 'ATOM', 'UNI', 'NEAR',
]);

/** Tickers are 1-20 characters of letters, digits, dot, dash or colon. Anything else is rejected. */
const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.:-]{0,19}$/;

export function normalizeMarketSymbol(symbol: string): string {
  const s = symbol.toUpperCase().trim();
  return s.startsWith('BINANCE:') ? s.slice('BINANCE:'.length) : s;
}

export function isValidSymbol(symbol: string): boolean {
  return SYMBOL_PATTERN.test(symbol.toUpperCase().trim());
}

export function isCryptoSymbol(symbol: string): boolean {
  const raw = symbol.toUpperCase().trim();
  if (raw.startsWith('BINANCE:')) return true;
  const s = normalizeMarketSymbol(raw);
  return s.length >= 5 && CRYPTO_QUOTES.some((quote) => s.endsWith(quote));
}

export type AssetType = 'stock' | 'etf' | 'crypto';

/** Splits BTCUSDT into BTC and USDT. Null for anything that isn't a crypto pair. */
export function splitCryptoPair(symbol: string): { base: string; quote: string } | null {
  const s = normalizeMarketSymbol(symbol);
  if (!isCryptoSymbol(s)) return null;
  const quote = CRYPTO_QUOTES.find((q) => s.endsWith(q) && s.length > q.length);
  return quote ? { base: s.slice(0, -quote.length), quote } : null;
}

/** BTCUSDT → BTC-USD. Null for cross pairs Yahoo can't serve. */
export function yahooCryptoSymbol(symbol: string): string | null {
  const pair = splitCryptoPair(symbol);
  if (!pair || !['USDT', 'USDC', 'USD'].includes(pair.quote)) return null;
  if (!YAHOO_CRYPTO_BASES.has(pair.base) && pair.base.length > 5) return null;
  return `${pair.base}-USD`;
}

/** USD pairs Binance lists as USDT. */
export function binanceSymbol(symbol: string): string {
  const s = normalizeMarketSymbol(symbol);
  return s.endsWith('USD') && !s.endsWith('BUSD') ? `${s}T` : s;
}
