'use server';

import { getCachedSession } from '@/lib/auth/session';
import { connectToDatabase } from '@/database/mongoose';
import { AiReportModel, createAiReport } from '@/database/models/aiReport.model';
import { OPEN_SIGNAL_STATUSES, SignalModel } from '@/database/models/signal.model';
import { explainSignal } from '@/lib/intelligence/explain';
import { getTrackedSymbols } from '@/lib/market/tracked-symbols';

const DAILY_ASK_LIMIT = 10;
const WHATS_CHANGED_QUERY = 'What changed?';

/** Explains the latest signal on a symbol the user follows. Limited per day to control cost. */
export async function askSignal(symbol: string) {
  const session = await getCachedSession();
  if (!session?.user?.id) {
    return { success: false as const, message: 'Not authenticated' };
  }

  const userId = session.user.id;
  const sym = symbol.toUpperCase();

  try {
    const tracked = await getTrackedSymbols(userId);
    if (!tracked.includes(sym)) {
      return { success: false as const, message: `${sym} isn't on your watchlist` };
    }

    await connectToDatabase();
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const used = await AiReportModel.countDocuments({ userId, query: WHATS_CHANGED_QUERY, createdAt: { $gte: startOfDay } });
    if (used >= DAILY_ASK_LIMIT) {
      return { success: false as const, message: `You've used all ${DAILY_ASK_LIMIT} summaries for today` };
    }

    const signal = await SignalModel.findOne({ symbol: sym, status: { $in: OPEN_SIGNAL_STATUSES } }).sort({ updatedAt: -1 }).lean();
    if (!signal) {
      return { success: false as const, message: `No significant signal on ${sym} right now` };
    }

    const explanation = await explainSignal(signal.signalId);
    if (!explanation) return { success: false as const, message: 'Could not explain this signal' };

    const summary = [explanation.whatChanged, explanation.context, explanation.watchNext].filter(Boolean).join(' ');
    // Logged per user for the daily limit
    await createAiReport({
      userId,
      symbol: sym,
      query: WHATS_CHANGED_QUERY,
      summary,
      confidence: signal.confidence / 100,
      signals: [],
      sources: [{ title: `Signal ${signal.signalId}`, type: 'indicator' }],
    });
    return { success: true as const, summary, source: explanation.source };
  } catch (err) {
    console.error('askSignal error:', err);
    return { success: false as const, message: 'The AI service is unavailable right now' };
  }
}
