/**
 * Shared vocabulary of the intelligence layer. Models, engine, API and UI all import
 * from here so an event or signal means the same thing everywhere.
 */
import type { ProviderId } from '@/lib/market/providers/types';

export type { AssetType } from '@/lib/market/symbols';

export const MARKET_EVENT_TYPES = [
  'PRICE_MOVE',
  'VOLUME_SPIKE',
  'BREAKOUT',
  'BREAKDOWN',
  'MOMENTUM_ACCELERATION',
  'MOMENTUM_REVERSAL',
  'VOLATILITY_EXPANSION',
  'VOLATILITY_CONTRACTION',
  'RSI_EXTREME',
  'MACD_CROSS',
  'MOVING_AVERAGE_CROSS',
  'VWAP_CROSS',
  'NEWS_EVENT',
  'EARNINGS_EVENT',
  'MARKET_OPEN',
  'MARKET_CLOSE',
  'SIGNAL_CREATED',
  'ALERT_TRIGGERED',
] as const;
export type MarketEventType = (typeof MARKET_EVENT_TYPES)[number];

export type EventDirection = 'up' | 'down' | 'neutral';
export type Severity = 'low' | 'medium' | 'high';
export type EventSource = 'detector' | 'news' | 'market' | 'alert' | 'signal';

export type MarketEventRecord = {
  eventId: string;
  symbol: string;
  eventType: MarketEventType;
  timestamp: string;
  direction: EventDirection;
  severity: Severity;
  source: EventSource;
  /** Detector inputs and outputs, all numbers computed deterministically. */
  data: Record<string, number | string | boolean | null>;
  /** Same detector, same symbol, same bar: the second write is dropped. */
  dedupeKey: string;
};

export const SIGNAL_STATUSES = ['DETECTED', 'ACTIVE', 'WEAKENING', 'INVALIDATED', 'RESOLVED'] as const;
export type SignalStatus = (typeof SIGNAL_STATUSES)[number];

export const SIGNAL_DIRECTIONS = ['strong_bullish', 'bullish', 'neutral', 'bearish', 'strong_bearish'] as const;
export type SignalDirection = (typeof SIGNAL_DIRECTIONS)[number];

export const SIGNAL_TYPES = [
  'MOMENTUM_BREAKOUT',
  'BREAKDOWN',
  'UNUSUAL_VOLUME',
  'MOMENTUM_SHIFT',
  'TREND_CHANGE',
  'VOLATILITY_REGIME',
  'PRICE_SHOCK',
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

/** Each 0..1. Missing means the factor couldn't be measured, which lowers confidence. */
export type ScoreComponents = Partial<
  Record<'trend' | 'momentum' | 'volume' | 'breakout' | 'volatility' | 'relativePerformance' | 'marketConfirmation' | 'news', number>
>;

export type EvidenceItem = {
  key: string;
  label: string;
  value: number;
  unit: 'pct' | 'x' | 'usd' | 'index' | 'count';
  /** Supports the signal's direction, or argues against it. */
  stance: 'supports' | 'contradicts' | 'context';
};

export type MarketContextClass = 'market-driven' | 'sector-driven' | 'asset-specific' | 'mixed' | 'unknown';

export type Provenance = {
  priceSource: ProviderId | null;
  candleSource: ProviderId | null;
  fallback: boolean;
  sourceTimestamp: string | null;
  calculatedAt: string;
};

export type MarketSession = 'pre' | 'regular' | 'post' | 'closed' | 'continuous';
