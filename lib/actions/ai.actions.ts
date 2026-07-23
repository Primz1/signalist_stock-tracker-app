'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/better-auth/auth';
import { connectToDatabase } from '@/database/mongoose';
import { createAiReport } from '@/database/models/aiReport.model';

export type ResearchFullResult = {
  symbol: string;
  summary: string;
  confidence: number;
  signals: { label: string; type: string }[];
  sources: { title: string; url?: string; type?: string }[];
  narrative?: Record<string, unknown>;
  snapshot?: Record<string, unknown>;
  news?: { headline?: string; url?: string }[];
};

export async function runAiResearch(symbol: string, query: string) {
  const session = await auth.api.getSession({ headers: await headers() });
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
        return { success: false as const, message: text || 'AI service error' };
      }
      const data = await legacy.json();
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
      return { success: true as const, data: data as ResearchFullResult };
    }

    const data = (await res.json()) as ResearchFullResult;

    await connectToDatabase();
    await createAiReport({
      userId: session.user.id,
      symbol: data.symbol,
      query,
      summary: data.summary,
      confidence: data.confidence,
      signals: data.signals as { label: string; type: 'bullish' | 'bearish' | 'neutral' | 'warning' }[],
      sources: (data.sources || []).map((s) => ({
        title: s.title,
        url: s.url,
        type: (s.type as 'news' | 'filing' | 'market' | 'indicator') || 'news',
      })),
    });

    return { success: true as const, data };
  } catch (err) {
    return {
      success: false as const,
      message: err instanceof Error ? err.message : 'Failed to reach AI service',
    };
  }
}
