'use server';

import { getCachedSession } from '@/lib/auth/session';
import { connectToDatabase } from '@/database/mongoose';
import { createAiReport, getLatestAiReport } from '@/database/models/aiReport.model';
import { Watchlist } from '@/database/models/watchlist.model';

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

  const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
  const secret = process.env.INTERNAL_API_SECRET || '';

  try {
    const res = await fetch(`${fastApiUrl}/agent/research/full`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': secret,
      },
      body: JSON.stringify({
        symbol: symbol.toUpperCase(),
        query,
        user_id: session.user.id,
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      // Fallback to legacy endpoint if full route missing
      const legacy = await fetch(`${fastApiUrl}/agent/research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': secret,
        },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          query,
          user_id: session.user.id,
        }),
        cache: 'no-store',
      });
      if (!legacy.ok) {
        const text = await legacy.text();
        return {
          success: false as const,
          message:
            text ||
            `AI service error (${legacy.status}). Is it running on ${fastApiUrl}? Try: npm run ai:dev`,
        };
      }
      const data = await legacy.json();
      try {
        await connectToDatabase();
        await createAiReport({
          userId: session.user.id,
          symbol: data.symbol,
          query,
          summary: data.summary,
          confidence: data.confidence,
          signals: data.signals,
          sources: data.sources,
        });
      } catch {
        /* persist is best-effort — don't fail the research response */
      }
      return { success: true as const, data: data as ResearchFullResult };
    }

    const data = (await res.json()) as ResearchFullResult;

    try {
      await connectToDatabase();
      await createAiReport({
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
    } catch {
      /* persist is best-effort */
    }

    return { success: true as const, data: { ...data, fromCache: false } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to reach AI service';
    const down =
      /fetch failed|ECONNREFUSED|ENOTFOUND|network|Unable to connect/i.test(msg) ||
      msg === 'Failed to fetch';
    return {
      success: false as const,
      message: down
        ? `AI service is not running at ${fastApiUrl}. Start it in a separate terminal: npm run ai:dev`
        : msg,
    };
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
  const session = await getCachedSession();
  if (!session?.user?.id) {
    return { success: false as const, message: 'Not authenticated' };
  }

  const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
  const secret = process.env.INTERNAL_API_SECRET || '';

  try {
    const res = await fetch(`${fastApiUrl}/quant/indicators`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': secret,
      },
      body: JSON.stringify({ symbol: symbol.toUpperCase(), lookback_days: 370 }),
      next: { revalidate: 120 },
    });
    if (!res.ok) {
      return { success: false as const, message: await res.text() };
    }
    const data = await res.json();
    return {
      success: true as const,
      data: { latest: (data.latest || {}) as ExtraIndicatorsLatest },
    };
  } catch (err) {
    return {
      success: false as const,
      message: err instanceof Error ? err.message : 'Failed to reach AI service',
    };
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
