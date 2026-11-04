import { MarketEventModel } from '@/database/models/marketEvent.model';
import { MarketSnapshotModel } from '@/database/models/marketSnapshot.model';
import { SignalModel, type SignalExplanation } from '@/database/models/signal.model';
import { postToAiService } from '@/lib/ai/service';
import { logError } from '@/lib/logger';
import { buildEvidence, deterministicExplanation, type SignalEvidence } from './evidence';
import { newsAround } from './news';
import { validateExplanation } from './validate';

/**
 * Signal → evidence → AI explanation → validation → stored. AI is enrichment: on any
 * failure the deterministic explanation is stored instead and the signal is unaffected.
 */

type AiExplanation = { what_changed: string; context: string; watch_next: string; validated: boolean };

// Room for the primary model (18s) and the fallback model on the AI service
const AI_TIMEOUT_MS = 45_000;

export async function loadEvidence(signalId: string): Promise<SignalEvidence | null> {
  const signal = await SignalModel.findOne({ signalId }).lean();
  if (!signal) return null;

  const [before, latest, events, news] = await Promise.all([
    MarketSnapshotModel.findOne({ symbol: signal.symbol, timeframe: '1m', timestamp: { $lte: signal.startedAt } })
      .sort({ timestamp: -1 })
      .select('price rsi')
      .lean(),
    MarketSnapshotModel.findOne({ symbol: signal.symbol, timeframe: '1m' }).sort({ timestamp: -1 }).select('price rsi vwap relativeVolume').lean(),
    MarketEventModel.find({ dedupeKey: { $in: signal.relatedEvents } }).select('timestamp eventType direction data').lean(),
    newsAround(signal.symbol, signal.startedAt, signal.updatedAt),
  ]);

  return buildEvidence({
    signal: { ...signal, keyLevel: signal.keyLevel ?? undefined, provenance: signal.provenance },
    before,
    latest,
    events,
    news,
  });
}

/** Asks the AI service, then validates every number. Returns null when the text can't be used. */
export async function aiExplanation(evidence: SignalEvidence): Promise<SignalExplanation | null> {
  let reply: AiExplanation;
  try {
    reply = await postToAiService<AiExplanation>('/agent/explain-signal', { evidence }, { timeoutMs: AI_TIMEOUT_MS });
  } catch (err) {
    logError('explain-signal unavailable', { symbol: evidence.symbol, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
  if (!reply?.validated) return null;

  const explanation: SignalExplanation = {
    whatChanged: reply.what_changed?.trim() ?? '',
    context: reply.context?.trim() ?? '',
    watchNext: reply.watch_next?.trim() ?? '',
    source: 'ai',
  };
  if (!explanation.whatChanged) return null;

  // The service checks too. This second check is the one the web app trusts.
  const check = validateExplanation(`${explanation.whatChanged} ${explanation.context} ${explanation.watchNext}`, evidence);
  if (!check.ok) {
    logError('explain-signal rejected', { symbol: evidence.symbol, uncited: check.uncited.join(','), advice: check.advice.join(',') });
    return null;
  }
  return explanation;
}

export async function explainSignal(signalId: string) {
  const evidence = await loadEvidence(signalId);
  if (!evidence) return null;
  const explanation = (await aiExplanation(evidence)) ?? deterministicExplanation(evidence);
  await SignalModel.updateOne(
    { signalId },
    {
      $set: {
        aiExplanation: explanation,
        aiGeneratedAt: new Date(),
        aiValidated: explanation.source === 'ai',
        aiEvidence: evidence,
      },
    }
  );
  return explanation;
}
