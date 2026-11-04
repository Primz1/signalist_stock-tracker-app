import type { SignalExplanation } from '@/database/models/signal.model';
import { signalTitle, SIGNAL_DIRECTION_LABELS } from './scoring';
import type { NormalizedNews } from './news';
import type {
  EvidenceItem,
  MarketContextClass,
  MarketEventType,
  SignalDirection,
  SignalStatus,
  SignalType,
} from './types';

/**
 * The only facts the AI sees. Every number is computed by the engine. The explanation
 * may restate these numbers and nothing else.
 */
export type SignalEvidence = {
  symbol: string;
  assetType: 'stock' | 'etf' | 'crypto';
  signal: {
    title: string;
    type: SignalType;
    direction: SignalDirection;
    status: SignalStatus;
    strength: number;
    confidence: number;
    context: MarketContextClass;
  };
  timeWindow: { start: string; end: string; minutes: number };
  price: { start?: number; current?: number; changePct?: number };
  volume: { relative?: number };
  indicators: { rsiBefore?: number; rsiNow?: number; vwap?: number };
  levels: { keyLevel?: number; kind?: 'resistance' | 'support' | 'anchor' };
  market: { benchmark?: string; benchmarkChangePct?: number; sector?: string; sectorChangePct?: number };
  events: { minutesFromStart: number; type: MarketEventType; direction: string; facts: Record<string, number | string | boolean | null> }[];
  news: { headline: string; publisher: string; minutesBeforeStart: number; url: string }[];
  provenance: { priceSource: string | null; sourceTimestamp: string | null; calculatedAt: string };
};

export type EvidenceInput = {
  signal: {
    symbol: string;
    assetType: 'stock' | 'etf' | 'crypto';
    type: SignalType;
    direction: SignalDirection;
    status: SignalStatus;
    strength: number;
    confidence: number;
    context: MarketContextClass;
    keyLevel?: number;
    evidence: EvidenceItem[];
    startedAt: Date;
    updatedAt: Date;
    provenance?: { priceSource?: string | null; sourceTimestamp?: string | null; calculatedAt?: string };
  };
  /** Snapshot at or just before the signal started, and the latest one. */
  before?: { price: number; rsi?: number } | null;
  latest?: { price: number; rsi?: number; vwap?: number; relativeVolume?: number } | null;
  events: { timestamp: Date; eventType: MarketEventType; direction: string; data: Record<string, number | string | boolean | null> }[];
  news: NormalizedNews[];
};

const round = (n: number | undefined, dp = 2) => (n == null || !Number.isFinite(n) ? undefined : Math.round(n * 10 ** dp) / 10 ** dp);
const minutesBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60_000);

export function buildEvidence(input: EvidenceInput): SignalEvidence {
  const { signal } = input;
  const item = (key: string) => signal.evidence.find((e) => e.key === key);
  const start = input.before?.price;
  const current = input.latest?.price;
  const levelEvent = input.events.find((e) => e.eventType === 'BREAKOUT' || e.eventType === 'BREAKDOWN');

  return {
    symbol: signal.symbol,
    assetType: signal.assetType,
    signal: {
      title: signalTitle(signal.type, signal.direction),
      type: signal.type,
      direction: signal.direction,
      status: signal.status,
      strength: signal.strength,
      confidence: signal.confidence,
      context: signal.context,
    },
    timeWindow: {
      start: signal.startedAt.toISOString(),
      end: signal.updatedAt.toISOString(),
      minutes: minutesBetween(signal.startedAt, signal.updatedAt),
    },
    price: {
      start: round(start),
      current: round(current),
      changePct: start && current ? round(((current - start) / start) * 100) : round(item('price')?.value),
    },
    volume: { relative: round(input.latest?.relativeVolume ?? item('relativeVolume')?.value, 1) },
    indicators: {
      rsiBefore: round(input.before?.rsi, 1),
      rsiNow: round(input.latest?.rsi ?? item('rsi')?.value, 1),
      vwap: signal.assetType === 'crypto' ? undefined : round(input.latest?.vwap ?? item('vwap')?.value),
    },
    levels: {
      keyLevel: round(signal.keyLevel),
      kind: signal.keyLevel == null ? undefined : levelEvent ? (levelEvent.eventType === 'BREAKOUT' ? 'resistance' : 'support') : 'anchor',
    },
    market: {
      benchmark: item('market')?.label,
      benchmarkChangePct: item('market')?.value,
      sector: item('sector')?.label,
      sectorChangePct: item('sector')?.value,
    },
    events: input.events
      .slice()
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map((e) => ({ minutesFromStart: minutesBetween(signal.startedAt, e.timestamp), type: e.eventType, direction: e.direction, facts: e.data })),
    news: input.news.map((n) => ({
      headline: n.headline,
      publisher: n.publisher,
      minutesBeforeStart: minutesBetween(n.publishedAt, signal.startedAt),
      url: n.url,
    })),
    provenance: {
      priceSource: signal.provenance?.priceSource ?? null,
      sourceTimestamp: signal.provenance?.sourceTimestamp ?? null,
      calculatedAt: signal.provenance?.calculatedAt ?? new Date().toISOString(),
    },
  };
}

const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 6 : 2 })}`;

const CONTEXT_SENTENCES: Record<MarketContextClass, string> = {
  'market-driven': 'The move is in line with the broader market.',
  'sector-driven': 'The move is in line with its sector.',
  'asset-specific': 'The move is specific to this asset: its benchmarks did not make a similar move.',
  mixed: 'The broader market gives a mixed picture for this move.',
  unknown: 'No benchmark comparison is available for this asset.',
};

/**
 * Plain-language explanation built from the evidence alone. Used when the AI is off,
 * slow, or cites a number it wasn't given. Never advice: it describes, it doesn't recommend.
 */
export function deterministicExplanation(e: SignalEvidence): SignalExplanation {
  const what: string[] = [];
  const direction = SIGNAL_DIRECTION_LABELS[e.signal.direction].toLowerCase();
  if (e.price.changePct != null) {
    what.push(`${e.symbol} moved ${pct(e.price.changePct)} over about ${e.timeWindow.minutes} minutes, a ${direction} reading.`);
  } else {
    what.push(`${e.symbol} shows a ${direction} ${e.signal.title.toLowerCase()} reading.`);
  }
  if (e.volume.relative != null) what.push(`Volume is ${e.volume.relative.toFixed(1)}x its usual level for this time of day.`);
  if (e.levels.keyLevel != null && e.levels.kind !== 'anchor') {
    what.push(`Price crossed the ${e.levels.kind} level near ${money(e.levels.keyLevel)}.`);
  }
  if (e.indicators.rsiBefore != null && e.indicators.rsiNow != null) {
    what.push(`RSI went from ${e.indicators.rsiBefore.toFixed(1)} to ${e.indicators.rsiNow.toFixed(1)}.`);
  } else if (e.indicators.rsiNow != null) {
    what.push(`RSI is ${e.indicators.rsiNow.toFixed(1)}.`);
  }

  const context: string[] = [CONTEXT_SENTENCES[e.signal.context]];
  if (e.market.benchmark && e.market.benchmarkChangePct != null) {
    context.push(`${e.market.benchmark} moved ${pct(e.market.benchmarkChangePct)} over the same window.`);
  }
  if (e.market.sector && e.market.sectorChangePct != null) {
    context.push(`${e.market.sector} moved ${pct(e.market.sectorChangePct)}.`);
  }
  const firstNews = e.news.find((n) => n.minutesBeforeStart >= 0);
  if (firstNews) {
    context.push(`${firstNews.publisher} published "${firstNews.headline}" ${firstNews.minutesBeforeStart} minutes before the move began. That timing is context, not proof of cause.`);
  }

  const watch: string[] = [];
  if (e.levels.keyLevel != null) {
    watch.push(`Whether price holds ${e.signal.direction.includes('bearish') ? 'below' : 'above'} ${money(e.levels.keyLevel)}. Moving back through it would invalidate this signal.`);
  }
  if (e.volume.relative != null) watch.push('Whether volume stays above its usual level.');

  return {
    whatChanged: what.join(' '),
    context: context.join(' '),
    watchNext: watch.join(' ') || 'Whether the move continues with confirmation from volume and momentum.',
    source: 'deterministic',
  };
}
