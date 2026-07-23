import { NextRequest, NextResponse } from 'next/server';
import { searchStocks, type SearchSymbolType } from '@/lib/actions/finnhub.actions';
import { getWatchlistSymbolsByEmail } from '@/lib/actions/watchlist.actions';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q') || '';
  const type = (searchParams.get('type') || 'all') as SearchSymbolType;
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)));

  let watchlistSymbols: string[] = [];
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.email) {
      watchlistSymbols = await getWatchlistSymbolsByEmail(session.user.email);
    }
  } catch {
    // public search still works without session
  }

  const rows = await searchStocks(q, watchlistSymbols, { type, limit });

  return NextResponse.json({
    results: rows.map((r) => ({
      symbol: r.symbol,
      name: r.name,
      exchange: r.exchange,
      type:
        'assetType' in r && r.assetType
          ? r.assetType
          : /crypto/i.test(r.type)
            ? 'crypto'
            : /etf/i.test(r.type)
              ? 'etf'
              : 'stock',
      is_watched: r.isInWatchlist,
      is_tradable: 'isTradable' in r ? Boolean((r as { isTradable?: boolean }).isTradable) : true,
    })),
  });
}
