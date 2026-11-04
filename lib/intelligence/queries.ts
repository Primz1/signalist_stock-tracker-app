import { connectToDatabase } from '@/database/mongoose';
import { MarketEventModel } from '@/database/models/marketEvent.model';
import { MarketSnapshotModel } from '@/database/models/marketSnapshot.model';
import { SignalModel, type SignalDoc, type SignalExplanation } from '@/database/models/signal.model';
import { describeEventFacts, EVENT_TYPE_LABELS } from './labels';
import { signalTitle } from './scoring';
import { IMMEDIATE_PUBLISH_STRENGTH } from './signal-engine';
import type {
  EvidenceItem,
  MarketContextClass,
  MarketEventType,
  Provenance,
  ScoreComponents,
  Severity,
  SignalDirection,
  SignalStatus,
  SignalType,
} from './types';

/** Plain, serializable views of signals for pages, the API and emails. */

export type SignalView = {
  signalId: string;
  symbol: string;
  assetType: 'stock' | 'etf' | 'crypto';
  title: string;
  type: SignalType;
  direction: SignalDirection;
  status: SignalStatus;
  strength: number;
  confidence: number;
  severity: Severity;
  context: MarketContextClass;
  keyLevel: number | null;
  startedAt: string;
  updatedAt: string;
  endedAt: string | null;
  components: ScoreComponents;
  evidence: EvidenceItem[];
  history: { status: SignalStatus; at: string; note: string }[];
  supportingTypes: MarketEventType[];
  contradictingTypes: MarketEventType[];
  provenance: Provenance | null;
  explanation: (SignalExplanation & { generatedAt: string | null }) | null;
};

export type SignalEventView = {
  id: string;
  time: string;
  type: MarketEventType;
  label: string;
  direction: 'up' | 'down' | 'neutral';
  severity: Severity;
  facts: string;
};

export type SignalDetailView = SignalView & {
  events: SignalEventView[];
  latest: { price: number; changePct: number | null; at: string; source: string | null } | null;
};

type StoredSignal = Pick<
  SignalDoc,
  | 'signalId' | 'symbol' | 'assetType' | 'type' | 'direction' | 'status' | 'strength' | 'confidence' | 'severity'
  | 'context' | 'keyLevel' | 'startedAt' | 'updatedAt' | 'endedAt' | 'components' | 'evidence' | 'history'
  | 'supportingTypes' | 'contradictingTypes' | 'provenance' | 'aiExplanation' | 'aiGeneratedAt'
>;

const iso = (d: Date | string | undefined | null) => (d ? new Date(d).toISOString() : null);

export function toSignalView(doc: StoredSignal): SignalView {
  return {
    signalId: doc.signalId,
    symbol: doc.symbol,
    assetType: doc.assetType,
    title: signalTitle(doc.type, doc.direction),
    type: doc.type,
    direction: doc.direction,
    status: doc.status,
    strength: doc.strength,
    confidence: doc.confidence,
    severity: doc.severity,
    context: doc.context,
    keyLevel: doc.keyLevel ?? null,
    startedAt: iso(doc.startedAt)!,
    updatedAt: iso(doc.updatedAt)!,
    endedAt: iso(doc.endedAt),
    components: doc.components ?? {},
    evidence: doc.evidence ?? [],
    history: (doc.history ?? []).map((h) => ({ status: h.status, at: iso(h.at)!, note: h.note })),
    supportingTypes: (doc.supportingTypes ?? []) as MarketEventType[],
    contradictingTypes: (doc.contradictingTypes ?? []) as MarketEventType[],
    provenance: doc.provenance ?? null,
    explanation: doc.aiExplanation ? { ...doc.aiExplanation, generatedAt: iso(doc.aiGeneratedAt) } : null,
  };
}

/** Only signals users are told about: they survived to ACTIVE, or started strong. */
const CONFIRMED = {
  $or: [{ 'history.status': { $in: ['ACTIVE', 'WEAKENING'] } }, { peakStrength: { $gte: IMMEDIATE_PUBLISH_STRENGTH } }],
};

export async function listSignals({ sinceHours = 48, limit = 100, symbols }: { sinceHours?: number; limit?: number; symbols?: string[] } = {}) {
  await connectToDatabase();
  const filter: Record<string, unknown> = { ...CONFIRMED, updatedAt: { $gte: new Date(Date.now() - sinceHours * 3_600_000) } };
  if (symbols) filter.symbol = { $in: symbols };
  const docs = await SignalModel.find(filter).sort({ updatedAt: -1 }).limit(limit).select('-aiEvidence -relatedEvents').lean();
  return docs.map(toSignalView);
}

export async function getSignalDetail(signalId: string): Promise<SignalDetailView | null> {
  await connectToDatabase();
  const doc = await SignalModel.findOne({ signalId, ...CONFIRMED }).lean();
  if (!doc) return null;
  const [events, latest] = await Promise.all([
    MarketEventModel.find({ dedupeKey: { $in: doc.relatedEvents } }).sort({ timestamp: 1 }).lean(),
    MarketSnapshotModel.findOne({ symbol: doc.symbol, timeframe: '1m' }).sort({ timestamp: -1 }).select('price change1d timestamp provenance').lean(),
  ]);
  return {
    ...toSignalView(doc),
    events: events.map((e) => ({
      id: e.dedupeKey,
      time: iso(e.timestamp)!,
      type: e.eventType,
      label: EVENT_TYPE_LABELS[e.eventType],
      direction: e.direction,
      severity: e.severity,
      facts: describeEventFacts(e.eventType, e.data),
    })),
    latest: latest
      ? { price: latest.price, changePct: latest.change1d ?? null, at: iso(latest.timestamp)!, source: latest.provenance?.priceSource ?? null }
      : null,
  };
}

export type MarketPulse = {
  symbol: string;
  price: number;
  changePct: number | null;
  at: string;
  session: string | null;
  source: string | null;
  fallback: boolean;
};

/** Latest analyzed price per symbol, with its age and source, for the live strip. */
export async function getMarketPulse(symbols: string[]): Promise<Record<string, MarketPulse>> {
  if (!symbols.length) return {};
  await connectToDatabase();
  const rows = await MarketSnapshotModel.aggregate<{ _id: string; doc: { price: number; change1d?: number; timestamp: Date; session?: string; provenance?: Provenance } }>([
    { $match: { symbol: { $in: symbols }, timeframe: '1m' } },
    { $sort: { timestamp: -1 } },
    { $group: { _id: '$symbol', doc: { $first: '$$ROOT' } } },
  ]);
  return Object.fromEntries(
    rows.map(({ _id, doc }) => [
      _id,
      {
        symbol: _id,
        price: doc.price,
        changePct: doc.change1d ?? null,
        at: iso(doc.timestamp)!,
        session: doc.session ?? null,
        source: doc.provenance?.priceSource ?? null,
        fallback: Boolean(doc.provenance?.fallback),
      },
    ])
  );
}

/** When the pipeline last analyzed anything, so the page can say how recent "quiet" is. */
export async function lastAnalysisAt() {
  await connectToDatabase();
  const latest = await MarketSnapshotModel.findOne({ timeframe: '1m' }).sort({ createdAt: -1 }).select('createdAt').lean();
  return iso((latest as { createdAt?: Date } | null)?.createdAt);
}
