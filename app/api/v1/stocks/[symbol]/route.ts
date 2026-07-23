import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api/auth';
import { connectToDatabase } from '@/database/mongoose';
import { getLatestSnapshot } from '@/database/models/marketSnapshot.model';
import { getStockScore } from '@/database/models/stockScore.model';
import { getLatestAiReport } from '@/database/models/aiReport.model';
import { fetchQuote } from '@/lib/market/ohlcv';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const apiKey = await authenticateApiRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }

  const { symbol } = await params;
  const sym = symbol.toUpperCase();

  await connectToDatabase();
  const [quote, snapshot, score] = await Promise.all([
    fetchQuote(sym),
    getLatestSnapshot(sym),
    getStockScore(sym),
  ]);

  const sentiment =
    (score?.factors?.momentum ?? 0) > 5 ? 'bullish' : (score?.factors?.momentum ?? 0) < -5 ? 'bearish' : 'neutral';

  return NextResponse.json({
    symbol: sym,
    price: quote?.price ?? snapshot?.price ?? null,
    changePercent: quote?.changePercent ?? snapshot?.changePercent ?? null,
    sentiment,
    score: score?.score ?? null,
    factors: score?.factors ?? null,
    indicators: snapshot?.indicators ?? null,
    usage: { keyPrefix: apiKey.keyPrefix, usageCount: apiKey.usageCount },
  });
}
