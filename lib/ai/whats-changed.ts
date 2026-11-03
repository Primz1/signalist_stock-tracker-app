import { connectToDatabase } from '@/database/mongoose';
import { createAiReport } from '@/database/models/aiReport.model';
import { EventModel } from '@/database/models/event.model';
import { postToAiService } from '@/lib/ai/service';
import { publishEvent } from '@/lib/events/publisher';
import { EVENT_TYPES, type SignalDetectedEvent } from '@/lib/events/types';
import { logError } from '@/lib/logger';

export const WHATS_CHANGED_QUERY = "What changed?";

const SIGNAL_WINDOW_MS = 24 * 60 * 60 * 1000;

type WhatsChangedResponse = {
  symbol: string;
  summary: string;
  confidence: number;
  signals: { label: string; type: 'bullish' | 'bearish' | 'neutral' | 'warning' }[];
};

/** Plain restatement of the signals, used whenever the AI service can't answer. */
export function fallbackSummary(symbol: string, signals: SignalDetectedEvent[]) {
  const details = signals.slice(0, 4).map((signal) => `${signal.label} (${signal.detail})`);
  return `${symbol} recent signals: ${details.join('; ')}.`;
}

async function explainSignals(symbol: string, signals: SignalDetectedEvent[]): Promise<WhatsChangedResponse> {
  try {
    return await postToAiService<WhatsChangedResponse>('/agent/whats-changed', { symbol, signals });
  } catch (err) {
    logError('whats-changed fell back', { symbol, error: err instanceof Error ? err.message : String(err) });
    return { symbol, summary: fallbackSummary(symbol, signals), confidence: 0.5, signals: [] };
  }
}

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
  const data = await explainSignals(symbol, signals);
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
