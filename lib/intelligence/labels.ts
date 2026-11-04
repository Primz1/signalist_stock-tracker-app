import type { MarketEventType } from './types';

/** Plain-language names for events, shared by the UI, the API and emails. */
export const EVENT_TYPE_LABELS: Record<MarketEventType, string> = {
  PRICE_MOVE: 'Sharp price move',
  VOLUME_SPIKE: 'Volume spike',
  BREAKOUT: 'Resistance breakout',
  BREAKDOWN: 'Support breakdown',
  MOMENTUM_ACCELERATION: 'Momentum accelerating',
  MOMENTUM_REVERSAL: 'Momentum reversal',
  VOLATILITY_EXPANSION: 'Volatility expanding',
  VOLATILITY_CONTRACTION: 'Volatility contracting',
  RSI_EXTREME: 'RSI extreme',
  MACD_CROSS: 'MACD cross',
  MOVING_AVERAGE_CROSS: 'Moving average cross',
  VWAP_CROSS: 'VWAP cross',
  NEWS_EVENT: 'News',
  EARNINGS_EVENT: 'Earnings',
  MARKET_OPEN: 'Market open',
  MARKET_CLOSE: 'Market close',
  SIGNAL_CREATED: 'Signal created',
  ALERT_TRIGGERED: 'Alert triggered',
};

type Facts = Record<string, number | string | boolean | null | undefined>;

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const signed = (n: number, dp = 2) => `${n > 0 ? '+' : ''}${n.toFixed(dp)}%`;
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 6 : 2 })}`;

/** One short line of the numbers behind an event, e.g. "2.6× usual volume over 15 min". */
export function describeEventFacts(type: MarketEventType, data: Facts): string {
  switch (type) {
    case 'PRICE_MOVE': {
      const change = num(data.changePct);
      const z = num(data.zScore);
      return change == null ? 'Unusual price move' : `${signed(change)} in ${data.windowMinutes} min${z ? `, ${z.toFixed(1)}× the usual move` : ''}`;
    }
    case 'VOLUME_SPIKE':
      return num(data.relativeVolume) != null ? `${num(data.relativeVolume)!.toFixed(1)}× usual volume for this time of day` : 'Volume well above usual';
    case 'BREAKOUT':
    case 'BREAKDOWN': {
      const level = num(data.level);
      return level != null ? `Closed ${type === 'BREAKOUT' ? 'above' : 'below'} ${usd(level)}` : EVENT_TYPE_LABELS[type];
    }
    case 'RSI_EXTREME':
      return num(data.rsi) != null ? `RSI ${num(data.rsiBefore)?.toFixed(0) ?? '?'} → ${num(data.rsi)!.toFixed(0)}` : 'RSI crossed an extreme';
    case 'MOMENTUM_ACCELERATION':
      return num(data.rsiChange) != null ? `RSI moved ${num(data.rsiChange)! > 0 ? '+' : ''}${num(data.rsiChange)!.toFixed(0)} points in ${data.windowMinutes} min` : 'Momentum accelerating';
    case 'MACD_CROSS':
      return 'MACD histogram changed sign';
    case 'MOVING_AVERAGE_CROSS':
      return `EMA20 crossed ${num(data.gapPct) != null && num(data.gapPct)! > 0 ? 'above' : 'below'} EMA50`;
    case 'VWAP_CROSS':
      return num(data.vwap) != null ? `Crossed VWAP at ${usd(num(data.vwap)!)}` : 'Crossed VWAP';
    case 'VOLATILITY_EXPANSION':
    case 'VOLATILITY_CONTRACTION':
      return num(data.volatilityRatio) != null ? `Volatility ${num(data.volatilityRatio)!.toFixed(1)}× usual` : EVENT_TYPE_LABELS[type];
    default:
      return EVENT_TYPE_LABELS[type] ?? type;
  }
}

export const CONTEXT_LABELS = {
  'market-driven': 'Moving with the market',
  'sector-driven': 'Moving with its sector',
  'asset-specific': 'Specific to this asset',
  mixed: 'Mixed market picture',
  unknown: 'No benchmark',
} as const;

export const STATUS_LABELS = {
  DETECTED: 'Detected',
  ACTIVE: 'Active',
  WEAKENING: 'Weakening',
  INVALIDATED: 'Invalidated',
  RESOLVED: 'Resolved',
} as const;

export const COMPONENT_LABELS = {
  trend: 'Trend alignment',
  momentum: 'Momentum',
  volume: 'Volume',
  breakout: 'Level break',
  volatility: 'Volatility',
  relativePerformance: 'Vs benchmark',
  marketConfirmation: 'Market agrees',
  news: 'News nearby',
} as const;

export type Freshness = 'live' | 'recent' | 'delayed' | 'stale' | 'unavailable';

/**
 * How current a value is. Data is never shown as live when it isn't. Thresholds suit a
 * 2-minute polling pipeline: two missed runs is delayed, a quarter hour is stale.
 */
export function freshnessOf(updatedAt: string | Date | null | undefined, now: number): Freshness {
  if (!updatedAt) return 'unavailable';
  const age = now - new Date(updatedAt).getTime();
  if (age <= 3 * 60_000) return 'live';
  if (age <= 6 * 60_000) return 'recent';
  if (age <= 15 * 60_000) return 'delayed';
  return 'stale';
}
