import type { DetectedEvent } from './detectors';
import type { BarSeries } from './series';
import { classifyContext, type ContextReading } from './context';
import type {
  EvidenceItem,
  MarketContextClass,
  MarketEventType,
  ScoreComponents,
  Severity,
  SignalDirection,
  SignalType,
} from './types';

/**
 * Deterministic scoring. Strength says how forceful the move is; confidence says how
 * much independent evidence agrees. A strong move on one indicator is high strength
 * and low confidence. Weights and formulas are documented in docs/SIGNAL_ENGINE.md.
 */

export const STRENGTH_WEIGHTS = { price: 0.3, momentum: 0.2, volume: 0.2, breakout: 0.15, trend: 0.15 } as const;
export const CONFIDENCE_WEIGHTS = { breadth: 0.45, agreement: 0.35, coverage: 0.2 } as const;
const COMPONENT_COUNT = 8;
const STRONG = 70;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const ok = (...values: (number | undefined)[]): boolean => values.every((v) => v != null && Number.isFinite(v));
const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

export type ScoreInput = {
  direction: 'up' | 'down' | 'neutral';
  /** Events in the signal's window, any direction. */
  events: DetectedEvent[];
  series: BarSeries;
  i: number;
  context: ContextReading;
  /** News items published inside the window. */
  newsCount?: number;
};

export type Score = {
  strength: number;
  confidence: number;
  components: ScoreComponents;
  direction: SignalDirection;
  severity: Severity;
  context: MarketContextClass;
  evidence: EvidenceItem[];
  supportingTypes: MarketEventType[];
  contradictingTypes: MarketEventType[];
};

/** Price, volume and level events. Everything else is supporting evidence. */
export const ANCHOR_TYPES: MarketEventType[] = ['PRICE_MOVE', 'VOLUME_SPIKE', 'BREAKOUT', 'BREAKDOWN', 'NEWS_EVENT'];

/** Event types that carry a direction of their own. Volatility events only add context. */
const DIRECTIONAL: MarketEventType[] = [
  'PRICE_MOVE',
  'VOLUME_SPIKE',
  'BREAKOUT',
  'BREAKDOWN',
  'MOMENTUM_ACCELERATION',
  'MOMENTUM_REVERSAL',
  'RSI_EXTREME',
  'MACD_CROSS',
  'MOVING_AVERAGE_CROSS',
  'VWAP_CROSS',
  'NEWS_EVENT',
];

export function scoreSignal(input: ScoreInput): Score {
  const { series: s, i, direction, events, context } = input;
  const d = direction === 'down' ? -1 : 1;
  const directional = direction !== 'neutral';
  const close = s.close[i];

  const supporting = new Set<MarketEventType>();
  const contradicting = new Set<MarketEventType>();
  for (const event of events) {
    if (!DIRECTIONAL.includes(event.eventType) || event.direction === 'neutral') continue;
    if (!directional || event.direction === direction) supporting.add(event.eventType);
    else contradicting.add(event.eventType);
  }

  const trendChecks = [
    [close, s.ema20[i]],
    [close, s.ema50[i]],
    [s.ema20[i], s.ema50[i]],
    ...(s.crypto ? [] : [[close, s.vwap[i]]]),
  ].filter(([a, b]) => ok(a, b));
  const components: ScoreComponents = {};
  if (directional && trendChecks.length) {
    components.trend = trendChecks.filter(([a, b]) => d * (a - b) > 0).length / trendChecks.length;
  }

  const momentumParts: number[] = [];
  if (ok(s.rsi[i])) momentumParts.push(clamp01((d * (s.rsi[i] - 50)) / 25));
  if (ok(s.macdHistogram[i])) momentumParts.push(d * s.macdHistogram[i] > 0 ? 1 : 0);
  if (directional && momentumParts.length) components.momentum = mean(momentumParts);

  const rv = s.relativeVolume[i];
  if (ok(rv)) components.volume = clamp01((rv - 1) / 2.5);

  if (directional) {
    const breakType = direction === 'up' ? 'BREAKOUT' : 'BREAKDOWN';
    components.breakout = events.some((e) => e.eventType === breakType) ? 1 : 0;
  }

  const volRatio = s.volatilityRatio[i];
  if (ok(volRatio)) components.volatility = clamp01((volRatio - 1) / 1.5);

  const reference = context.sectorChangePct ?? context.marketChangePct;
  if (directional && ok(reference, context.assetChangePct)) {
    components.relativePerformance = clamp01((d * (context.assetChangePct - reference!)) / 2);
  }
  if (directional && ok(context.marketChangePct)) {
    components.marketConfirmation = clamp01((d * context.marketChangePct!) / 1);
  }
  if (input.newsCount) components.news = 1;

  // Price force: the 15-minute move in units of the usual move for that window
  const std = s.returnStd[i];
  const move15 = s.change15[i];
  const priceForce = ok(std, move15) && std > 0 ? clamp01((d * move15) / (std * Math.sqrt(15)) / 6) : 0;

  const strength = directional
    ? Math.round(
        100 *
          (STRENGTH_WEIGHTS.price * priceForce +
            STRENGTH_WEIGHTS.momentum * (components.momentum ?? 0) +
            STRENGTH_WEIGHTS.volume * (components.volume ?? 0) +
            STRENGTH_WEIGHTS.breakout * (components.breakout ?? 0) +
            STRENGTH_WEIGHTS.trend * (components.trend ?? 0))
      )
    : Math.round(100 * (components.volatility ?? 0));

  const measured = Object.keys(components).length;
  const strongComponents = [components.trend, components.momentum, components.volume].filter((c) => c != null && c >= 0.6).length;
  const weakComponents = [components.trend, components.momentum].filter((c) => c != null && c <= 0.2).length;
  // A move that price itself doesn't show is evidence against the signal
  const priceAgainst = directional && priceForce <= 0.1 ? 1 : 0;
  const support = supporting.size + strongComponents;
  const against = contradicting.size + weakComponents + priceAgainst;
  const agreement = support + against ? support / (support + against) : 0;
  // Price, volume and level events count fully. Oscillator crossings count half: they fire constantly.
  const weightedTypes = [...supporting].reduce((sum, t) => sum + (ANCHOR_TYPES.includes(t) ? 1 : 0.5), 0);
  const breadth = Math.min(1, weightedTypes / 3);
  const coverage = measured / COMPONENT_COUNT;
  const confidence = Math.round(
    100 * (CONFIDENCE_WEIGHTS.breadth * breadth + CONFIDENCE_WEIGHTS.agreement * agreement + CONFIDENCE_WEIGHTS.coverage * coverage)
  );

  const signalDirection: SignalDirection = !directional
    ? 'neutral'
    : direction === 'up'
      ? strength >= STRONG ? 'strong_bullish' : 'bullish'
      : strength >= STRONG ? 'strong_bearish' : 'bearish';
  const severity: Severity = strength >= STRONG && confidence >= STRONG ? 'high' : strength >= 45 ? 'medium' : 'low';

  return {
    strength,
    confidence,
    components: Object.fromEntries(Object.entries(components).map(([k, v]) => [k, round(v)])) as ScoreComponents,
    direction: signalDirection,
    severity,
    context: classifyContext(context),
    evidence: buildEvidence(input, d),
    supportingTypes: [...supporting],
    contradictingTypes: [...contradicting],
  };
}

function buildEvidence({ series: s, i, events, context }: ScoreInput, d: number): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const stance = (value: number) => (d * value > 0 ? 'supports' : d * value < 0 ? 'contradicts' : 'context') as EvidenceItem['stance'];

  if (ok(context.assetChangePct)) {
    items.push({ key: 'price', label: `Price, last ${context.windowMinutes} min`, value: round(context.assetChangePct), unit: 'pct', stance: stance(context.assetChangePct) });
  }
  if (ok(s.relativeVolume[i])) {
    items.push({ key: 'relativeVolume', label: 'Relative volume', value: round(s.relativeVolume[i], 1), unit: 'x', stance: s.relativeVolume[i] >= 1.5 ? 'supports' : 'context' });
  }
  if (ok(s.rsi[i])) {
    items.push({ key: 'rsi', label: 'RSI (14)', value: round(s.rsi[i], 1), unit: 'index', stance: stance(s.rsi[i] - 50) });
  }
  const level = events.find((e) => e.eventType === 'BREAKOUT' || e.eventType === 'BREAKDOWN');
  if (level && typeof level.data.level === 'number') {
    items.push({ key: 'level', label: level.eventType === 'BREAKOUT' ? 'Resistance crossed' : 'Support crossed', value: level.data.level, unit: 'usd', stance: 'supports' });
  }
  if (!s.crypto && ok(s.vwap[i])) {
    items.push({ key: 'vwap', label: 'VWAP', value: round(s.vwap[i], 2), unit: 'usd', stance: stance(s.close[i] - s.vwap[i]) });
  }
  if (context.marketChangePct != null && context.marketSymbol) {
    items.push({ key: 'market', label: context.marketSymbol, value: round(context.marketChangePct), unit: 'pct', stance: 'context' });
  }
  if (context.sectorChangePct != null && context.sectorSymbol) {
    items.push({ key: 'sector', label: context.sectorSymbol, value: round(context.sectorChangePct), unit: 'pct', stance: 'context' });
  }
  if (ok(s.volatilityRatio[i])) {
    items.push({ key: 'volatility', label: 'Volatility vs usual', value: round(s.volatilityRatio[i], 1), unit: 'x', stance: 'context' });
  }
  return items;
}

/** What the cluster of events looks like, most specific first. */
export function classifySignal(types: Set<MarketEventType>, direction: 'up' | 'down' | 'neutral', events: DetectedEvent[]): SignalType {
  if (direction === 'neutral') return 'VOLATILITY_REGIME';
  if (types.has('BREAKOUT') && direction === 'up') return 'MOMENTUM_BREAKOUT';
  if (types.has('BREAKDOWN') && direction === 'down') return 'BREAKDOWN';
  const bigMove = events.some((e) => e.eventType === 'PRICE_MOVE' && e.severity === 'high');
  if (types.has('PRICE_MOVE') && (bigMove || types.has('VOLUME_SPIKE'))) return 'PRICE_SHOCK';
  if (types.has('VOLUME_SPIKE')) return 'UNUSUAL_VOLUME';
  if (types.has('MOVING_AVERAGE_CROSS') || types.has('VWAP_CROSS')) return 'TREND_CHANGE';
  if (types.has('MOMENTUM_ACCELERATION') || types.has('MACD_CROSS') || types.has('RSI_EXTREME')) return 'MOMENTUM_SHIFT';
  return 'PRICE_SHOCK';
}

export const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  MOMENTUM_BREAKOUT: 'Momentum breakout',
  BREAKDOWN: 'Breakdown',
  UNUSUAL_VOLUME: 'Unusual volume',
  MOMENTUM_SHIFT: 'Momentum shift',
  TREND_CHANGE: 'Trend change',
  VOLATILITY_REGIME: 'Volatility expanding',
  PRICE_SHOCK: 'Sharp move',
};

export const SIGNAL_DIRECTION_LABELS: Record<SignalDirection, string> = {
  strong_bullish: 'Strong bullish',
  bullish: 'Bullish',
  neutral: 'Neutral',
  bearish: 'Bearish',
  strong_bearish: 'Strong bearish',
};

export function signalTitle(type: SignalType, direction: SignalDirection) {
  if (type === 'VOLATILITY_REGIME') return SIGNAL_TYPE_LABELS[type];
  const tone = direction.includes('bullish') ? 'Bullish' : direction.includes('bearish') ? 'Bearish' : '';
  return `${tone} ${SIGNAL_TYPE_LABELS[type].toLowerCase()}`.trim();
}
