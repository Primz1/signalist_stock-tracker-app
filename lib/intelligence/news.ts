import crypto from 'crypto';
import { NewsItemModel } from '@/database/models/newsItem.model';
import { logError } from '@/lib/logger';
import { FinnhubProvider, type FinnhubNewsItem } from '@/lib/market/providers/finnhub';
import { isCryptoSymbol, splitCryptoPair } from '@/lib/market/symbols';

/**
 * News near a signal is context, never a cause. Callers say "published N minutes before
 * the move", not "this caused the move".
 */

export const NEWS_SETTINGS = {
  /** How far before a signal's first event news still counts as nearby. */
  lookbackMinutes: 120,
  maxItems: 5,
} as const;

const CRYPTO_NAMES: Record<string, string[]> = {
  BTC: ['bitcoin', 'btc'],
  ETH: ['ethereum', 'ether', 'eth'],
  SOL: ['solana', 'sol'],
  XRP: ['xrp', 'ripple'],
  DOGE: ['dogecoin', 'doge'],
  ADA: ['cardano', 'ada'],
  BNB: ['bnb', 'binance coin'],
};

export type NormalizedNews = {
  newsId: string;
  headline: string;
  publisher: string;
  url: string;
  publishedAt: Date;
  symbols: string[];
  summary?: string;
  source: 'FINNHUB';
};

export function normalizeNews(raw: FinnhubNewsItem, symbols: string[]): NormalizedNews | null {
  if (!raw.headline?.trim() || !raw.url || !raw.datetime) return null;
  // Only links to the web. Anything else is not something we show users.
  if (!/^https?:\/\//i.test(raw.url)) return null;
  return {
    newsId: crypto.createHash('sha256').update(raw.url).digest('hex'),
    headline: raw.headline.trim().slice(0, 300),
    publisher: (raw.source ?? 'Unknown').trim().slice(0, 80),
    url: raw.url,
    publishedAt: new Date(raw.datetime * 1000),
    symbols,
    summary: raw.summary?.trim().slice(0, 600) || undefined,
    source: 'FINNHUB',
  };
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Fetches news for the window, stores it, and returns the items inside the window, oldest first. */
export async function newsAround(symbol: string, start: Date, end: Date, provider = new FinnhubProvider()): Promise<NormalizedNews[]> {
  const from = new Date(start.getTime() - NEWS_SETTINGS.lookbackMinutes * 60_000);
  let raw: FinnhubNewsItem[] = [];
  try {
    if (isCryptoSymbol(symbol)) {
      const base = splitCryptoPair(symbol)?.base ?? symbol;
      const names = CRYPTO_NAMES[base] ?? [base.toLowerCase()];
      // Crypto news isn't tagged by symbol, so match the coin's name in the headline
      raw = (await provider.getMarketNews('crypto')).filter((n) =>
        names.some((name) => new RegExp(`\\b${name}\\b`, 'i').test(n.headline ?? ''))
      );
    } else {
      raw = await provider.getCompanyNews(symbol, isoDate(from), isoDate(end));
    }
  } catch (err) {
    logError('news fetch failed', { symbol, error: err instanceof Error ? err.message : String(err) });
  }

  const items = raw
    .map((n) => normalizeNews(n, [symbol]))
    .filter((n): n is NormalizedNews => n !== null && n.publishedAt >= from && n.publishedAt <= end)
    .sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime())
    .slice(-NEWS_SETTINGS.maxItems);

  if (items.length) {
    await NewsItemModel.bulkWrite(
      items.map(({ symbols: _symbols, ...item }) => ({
        updateOne: {
          filter: { newsId: item.newsId },
          // symbols is merged, not overwritten, when another asset already stored this story
          update: { $setOnInsert: item, $addToSet: { symbols: symbol } },
          upsert: true,
        },
      })),
      { ordered: false }
    ).catch((err) => logError('news store failed', { symbol, error: err instanceof Error ? err.message : String(err) }));
  }
  return items;
}
