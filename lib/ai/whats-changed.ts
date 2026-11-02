import { connectToDatabase } from '@/database/mongoose';
import { createAiReport } from '@/database/models/aiReport.model';
import { EventModel } from '@/database/models/event.model';
import { publishEvent } from '@/lib/events/publisher';
import { EVENT_TYPES, type SignalDetectedEvent } from '@/lib/events/types';

export const WHATS_CHANGED_QUERY = "What changed?";

const SIGNAL_WINDOW_MS = 24 * 60 * 60 * 1000;

type WhatsChangedResponse = {
  symbol: string;
  summary: string;
  confidence: number;
  signals: { label: string; type: 'bullish' | 'bearish' | 'neutral' | 'warning' }[];
};

/**
 * Explains a symbol's recent signals and publishes the result. Without a userId the
 * report is public to everyone tracking the symbol, so one Gemini call serves them all.
 */
export async function createWhatsChangedReport(symbol: string, userId?: string) {
  await connectToDatabase();
  const docs = await EventModel.find({
    type: EVENT_TYPES.SIGNAL_DETECTED,
    symbol,
    createdAt: { $gte: new Date(Date.now() - SIGNAL_WINDOW_MS) },
  })
    .sort({ _id: -1 })
    .limit(10)
    .lean();
  if (!docs.length) return null;

  const signals = docs.map((doc) => doc.payload as unknown as SignalDetectedEvent);
  const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
  const res = await fetch(`${fastApiUrl}/agent/whats-changed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
    },
    body: JSON.stringify({ symbol, signals }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`AI service error (${res.status})`);

  const data = (await res.json()) as WhatsChangedResponse;
  const report = await createAiReport({
    userId,
    symbol,
    query: WHATS_CHANGED_QUERY,
    summary: data.summary,
    confidence: data.confidence,
    signals: data.signals,
    sources: signals.map((signal) => ({ title: `${signal.label}: ${signal.detail}`, type: 'indicator' as const })),
  });

  await publishEvent({
    type: EVENT_TYPES.AI_REPORT_CREATED,
    userId,
    payload: {
      reportId: String(report._id),
      symbol,
      summary: report.summary,
      timestamp: new Date().toISOString(),
    },
  });
  return report;
}
