'use server';

import { getCachedSession } from '@/lib/auth/session';
import { connectToDatabase } from '@/database/mongoose';
import { createAiReport, getLatestAiReport } from '@/database/models/aiReport.model';
import { Watchlist } from '@/database/models/watchlist.model';
import { postToAiService } from '@/lib/ai/service';
import { publishEvent } from '@/lib/events/publisher';
import { EVENT_TYPES } from '@/lib/events/types';
import { logError } from '@/lib/logger';

// Longer than the default so a Render cold start can finish
const RESEARCH_TIMEOUT_MS = 55_000;
const AI_UNAVAILABLE_MESSAGE = 'AI research is unavailable right now. Market data and signals still work.';

export type ResearchFullResult = {
  symbol: string;
  summary: string;
  confidence: number;
  signals: { label: string; type: string }[];
  sources: { title: string; url?: string; type?: string }[];
  narrative?: Record<string, unknown>;
  snapshot?: Record<string, unknown>;
  news?: { headline?: string; url?: string }[];
  fromCache?: boolean;
};

async function publishReportCreated(report: { _id: unknown; symbol: string; summary: string }, userId: string) {
  await publishEvent({
    type: EVENT_TYPES.AI_REPORT_CREATED,
    userId,
    payload: {
      reportId: String(report._id),
      symbol: report.symbol,
      summary: report.summary,
      timestamp: new Date().toISOString(),
    },
  });
}

function mapDbReport(doc: Record<string, unknown>): ResearchFullResult {
  return {
    symbol: String(doc.symbol || '').toUpperCase(),
    summary: String(doc.summary || ''),
    confidence: Number(doc.confidence ?? 0),
    signals: (Array.isArray(doc.signals) ? doc.signals : []) as ResearchFullResult['signals'],
    sources: (Array.isArray(doc.sources) ? doc.sources : []) as ResearchFullResult['sources'],
    fromCache: true,
  };
}

/** Fast path: latest saved AiReport for this user+symbol (no FastAPI). */
export async function getCachedAiResearch(symbol: string) {
  const session = await getCachedSession();
  if (!session?.user?.id) {
    return { success: false as const, message: 'Not authenticated' };
  }

  const sym = symbol.toUpperCase();
  try {
    await connectToDatabase();
    const doc = await getLatestAiReport(sym, session.user.id);
    if (!doc) {
      return { success: true as const, data: null };
    }
    return {
      success: true as const,
      data: mapDbReport(doc as Record<string, unknown>),
    };
  } catch (err) {
    return {
      success: false as const,
      message: err instanceof Error ? err.message : 'Failed to load cached research',
    };
  }
}

export async function runAiResearch(symbol: string, query: string) {
  const session = await getCachedSession();
  if (!session?.user?.id) {
    return { success: false as const, message: 'Not authenticated' };
  }

  try {
    const data = await postToAiService<ResearchFullResult>(
      '/agent/research/full',
      { symbol: symbol.toUpperCase(), query, user_id: session.user.id },
      { timeoutMs: RESEARCH_TIMEOUT_MS }
    );

    try {
      await connectToDatabase();
      const report = await createAiReport({
        userId: session.user.id,
        symbol: data.symbol,
        query,
        summary: data.summary,
        confidence: data.confidence,
        signals: data.signals as {
          label: string;
          type: 'bullish' | 'bearish' | 'neutral' | 'warning';
        }[],
        sources: (data.sources || []).map((s) => ({
          title: s.title,
          url: s.url,
          type: (s.type as 'news' | 'filing' | 'market' | 'indicator') || 'news',
        })),
      });
      await publishReportCreated(report, session.user.id);
    } catch {
      /* persist is best-effort */
    }

    return { success: true as const, data: { ...data, fromCache: false } };
  } catch (err) {
    logError('research failed', { symbol, error: err instanceof Error ? err.message : String(err) });
    return { success: false as const, message: AI_UNAVAILABLE_MESSAGE };
  }
}

export type ExtraIndicatorsLatest = {
  adx?: number | null;
  adx_pos?: number | null;
  adx_neg?: number | null;
  stoch_k?: number | null;
  stoch_d?: number | null;
  cci?: number | null;
  willr?: number | null;
  mfi?: number | null;
  atr?: number | null;
};

export async function getExtraIndicators(symbol: string) {
  if (!process.env.MONGODB_URI) return { success: false, data: null };
  const session = await getCachedSession();
  if (!session?.user?.id) {
    return { success: false as const, message: 'Not authenticated' };
  }

  try {
    const data = await postToAiService<{ latest?: ExtraIndicatorsLatest }>(
      '/quant/indicators',
      { symbol: symbol.toUpperCase(), lookback_days: 370 },
      { revalidate: 120 }
    );
    return { success: true as const, data: { latest: data.latest || {} } };
  } catch {
    return { success: false as const, message: AI_UNAVAILABLE_MESSAGE };
  }
}

export async function getResearchHeader(symbol: string) {
  const session = await getCachedSession();
  if (!session?.user?.id) {
    return { success: false as const, message: 'Not authenticated' };
  }

  const sym = symbol.toUpperCase();
  const { getStockProfile } = await import('@/lib/actions/finnhub.actions');
  const { fetchQuote, isCryptoSymbol, normalizeMarketSymbol } = await import(
    '@/lib/market/ohlcv'
  );
  const { getStockScore } = await import('@/database/models/stockScore.model');

  await connectToDatabase();

  const [profile, quote, inWatchlist, score] = await Promise.all([
    isCryptoSymbol(sym) ? Promise.resolve(null) : getStockProfile(sym),
    fetchQuote(sym),
    Watchlist.exists({ userId: session.user.id, symbol: sym }),
    getStockScore(sym).catch(() => null),
  ]);

  const aiScore = score?.score ?? null;

  // Reject stale/wrong Finnhub profiles that don't match the requested ticker
  const profileTicker = profile?.ticker ? String(profile.ticker).toUpperCase() : '';
  const profileOk =
    !!profile?.name &&
    (!profileTicker ||
      profileTicker === sym ||
      profileTicker === normalizeMarketSymbol(sym) ||
      sym.startsWith(profileTicker));

  const cryptoName = isCryptoSymbol(sym)
    ? `${normalizeMarketSymbol(sym)} (crypto)`
    : null;

  return {
    success: true as const,
    data: {
      symbol: sym,
      name: profileOk ? profile!.name : cryptoName || sym,
      exchange: profileOk
        ? profile?.exchange
        : isCryptoSymbol(sym)
          ? 'BINANCE'
          : undefined,
      logo: profileOk ? profile?.logo : undefined,
      price: quote?.price,
      change: quote?.change,
      changePercent: quote?.changePercent,
      isInWatchlist: !!inWatchlist,
      aiScore,
    },
  };
}
