'use server';

import { getCachedSession } from '@/lib/auth/session';
import { connectToDatabase } from '@/database/mongoose';
import { AiReportModel } from '@/database/models/aiReport.model';
import { createWhatsChangedReport, WHATS_CHANGED_QUERY } from '@/lib/ai/whats-changed';
import { getTrackedSymbols } from '@/lib/market/tracked-symbols';

const DAILY_ASK_LIMIT = 10;

/** Asks the AI what changed for a symbol the user follows. Limited per day to control cost. */
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
    const used = await AiReportModel.countDocuments({
      userId,
      query: WHATS_CHANGED_QUERY,
      createdAt: { $gte: startOfDay },
    });
    if (used >= DAILY_ASK_LIMIT) {
      return { success: false as const, message: `You've used all ${DAILY_ASK_LIMIT} summaries for today` };
    }

    const report = await createWhatsChangedReport(sym, userId);
    if (!report) {
      return { success: false as const, message: `No signals for ${sym} in the last 24 hours` };
    }
    return { success: true as const, summary: report.summary };
  } catch (err) {
    console.error('askSignal error:', err);
    return { success: false as const, message: 'The AI service is unavailable right now' };
  }
}
