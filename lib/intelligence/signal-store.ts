import type { SignalDoc } from '@/database/models/signal.model';
import type { EngineSignal } from './signal-engine';
import type { Provenance } from './types';

/** Converts between the engine's in-memory signal (unix seconds) and the stored document. */

const toDate = (seconds: number) => new Date(seconds * 1000);
const toSeconds = (date: Date | string) => Math.floor(new Date(date).getTime() / 1000);

export function toSignalDocument(signal: EngineSignal, provenance: Provenance) {
  const { score } = signal;
  return {
    signalId: signal.signalId,
    symbol: signal.symbol,
    assetType: signal.assetType,
    type: signal.type,
    direction: score.direction,
    strength: score.strength,
    confidence: score.confidence,
    severity: score.severity,
    status: signal.status,
    components: score.components,
    evidence: score.evidence,
    relatedEvents: signal.relatedEvents,
    keyLevel: signal.keyLevel,
    context: score.context,
    provenance,
    history: signal.history.map((h) => ({ ...h, at: toDate(h.at) })),
    startedAt: toDate(signal.startedAt),
    updatedAt: toDate(signal.updatedAt),
    endedAt: signal.endedAt != null ? toDate(signal.endedAt) : undefined,
    side: signal.side,
    peakStrength: signal.peakStrength,
    lastSupportAt: toDate(signal.lastSupportAt),
    supportingTypes: score.supportingTypes,
    contradictingTypes: score.contradictingTypes,
  };
}

type StoredSignal = Pick<
  SignalDoc,
  | 'signalId' | 'symbol' | 'assetType' | 'type' | 'direction' | 'strength' | 'confidence' | 'severity' | 'status'
  | 'components' | 'evidence' | 'relatedEvents' | 'keyLevel' | 'context' | 'history' | 'startedAt' | 'updatedAt'
  | 'endedAt' | 'side' | 'peakStrength' | 'lastSupportAt' | 'supportingTypes' | 'contradictingTypes'
>;

export function fromSignalDocument(doc: StoredSignal): EngineSignal {
  return {
    signalId: doc.signalId,
    symbol: doc.symbol,
    assetType: doc.assetType,
    type: doc.type,
    side: doc.side,
    status: doc.status,
    score: {
      strength: doc.strength,
      confidence: doc.confidence,
      components: doc.components ?? {},
      direction: doc.direction,
      severity: doc.severity,
      context: doc.context,
      evidence: doc.evidence ?? [],
      supportingTypes: (doc.supportingTypes ?? []) as EngineSignal['score']['supportingTypes'],
      contradictingTypes: (doc.contradictingTypes ?? []) as EngineSignal['score']['contradictingTypes'],
    },
    peakStrength: doc.peakStrength,
    relatedEvents: doc.relatedEvents ?? [],
    keyLevel: doc.keyLevel ?? undefined,
    startedAt: toSeconds(doc.startedAt),
    updatedAt: toSeconds(doc.updatedAt),
    endedAt: doc.endedAt ? toSeconds(doc.endedAt) : undefined,
    lastSupportAt: toSeconds(doc.lastSupportAt),
    history: (doc.history ?? []).map((h) => ({ status: h.status, at: toSeconds(h.at), note: h.note })),
  };
}
