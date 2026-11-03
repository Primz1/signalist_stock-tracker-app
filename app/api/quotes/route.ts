import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { marketData } from '@/lib/market/service';
import { isValidSymbol, normalizeMarketSymbol } from '@/lib/market/symbols';

export const dynamic = 'force-dynamic';

const MAX_SYMBOLS = 50;

/** Quotes for the signed-in user's screens, so browsers never call vendors or hold their keys. */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const raw = (request.nextUrl.searchParams.get('symbols') ?? '').split(',').filter(Boolean);
  if (!raw.length || raw.length > MAX_SYMBOLS) {
    return NextResponse.json({ error: `Pass 1 to ${MAX_SYMBOLS} comma-separated symbols` }, { status: 400 });
  }
  const invalid = raw.filter((symbol) => !isValidSymbol(symbol));
  if (invalid.length) {
    return NextResponse.json({ error: `Invalid symbols: ${invalid.slice(0, 5).join(', ')}` }, { status: 400 });
  }

  const quotes = await marketData.getQuotes(raw.map(normalizeMarketSymbol));
  return NextResponse.json(
    {
      quotes: [...quotes.values()].map((quote) => ({
        symbol: quote.symbol,
        price: quote.price,
        changePercent: quote.changePercent ?? null,
        volume: quote.volume ?? null,
        high: quote.high ?? null,
        low: quote.low ?? null,
        source: quote.source,
        fallback: quote.fallback,
        sourceTimestamp: quote.sourceTimestamp ?? null,
        fetchedAt: quote.fetchedAt,
      })),
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
