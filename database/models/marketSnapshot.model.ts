import { Schema, model, models, type Document, type Model } from 'mongoose';
import type { MarketSession, Provenance } from '@/lib/intelligence/types';

/** Derived analytics for one asset at one moment. Every field is computed, never generated. */
export type SnapshotAnalytics = {
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  change1m?: number;
  change5m?: number;
  change15m?: number;
  change1h?: number;
  change1d?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
  roc?: number;
  ema20?: number;
  ema50?: number;
  ema200?: number;
  sma20?: number;
  sma50?: number;
  sma200?: number;
  vwap?: number;
  atr?: number;
  bollingerUpper?: number;
  bollingerMiddle?: number;
  bollingerLower?: number;
  relativeVolume?: number;
  volatility?: number;
  sessionHigh?: number;
  sessionLow?: number;
  previousDayHigh?: number;
  previousDayLow?: number;
  resistance?: number;
  support?: number;
};

export const SNAPSHOT_ANALYTICS_FIELDS = [
  'open', 'high', 'low', 'close', 'change1m', 'change5m', 'change15m', 'change1h', 'change1d', 'rsi', 'macd',
  'macdSignal', 'macdHistogram', 'roc', 'ema20', 'ema50', 'ema200', 'sma20', 'sma50', 'sma200', 'vwap', 'atr',
  'bollingerUpper', 'bollingerMiddle', 'bollingerLower', 'relativeVolume', 'volatility', 'sessionHigh',
  'sessionLow', 'previousDayHigh', 'previousDayLow', 'resistance', 'support',
] as const satisfies readonly (keyof SnapshotAnalytics)[];

export interface MarketSnapshot extends Document, SnapshotAnalytics {
  symbol: string;
  price: number;
  volume?: number;
  changePercent?: number;
  timeframe?: string;
  session?: MarketSession;
  provenance?: Provenance;
  /** Legacy shape kept for the current signal detector until it reads the analytics fields. */
  ohlcv?: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }[];
  indicators?: {
    sma20?: number;
    sma50?: number;
    rsi14?: number;
    macd?: { macd: number; signal: number; histogram: number };
    bollinger?: { upper: number; middle: number; lower: number };
  };
  timestamp: Date;
  expiresAt?: Date;
}

const MarketSnapshotSchema = new Schema<MarketSnapshot>(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    price: { type: Number, required: true },
    volume: { type: Number },
    changePercent: { type: Number },
    timeframe: { type: String },
    session: { type: String },
    provenance: { type: Schema.Types.Mixed },
    ...Object.fromEntries(SNAPSHOT_ANALYTICS_FIELDS.map((field) => [field, { type: Number }])),
    ohlcv: { type: Schema.Types.Mixed },
    indicators: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

MarketSnapshotSchema.index({ symbol: 1, timestamp: -1 });
// Snapshots are working data, so a TTL keeps Atlas M0 from filling up
MarketSnapshotSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const MarketSnapshotModel: Model<MarketSnapshot> =
  (models?.MarketSnapshot as Model<MarketSnapshot>) ||
  model<MarketSnapshot>('MarketSnapshot', MarketSnapshotSchema);

export const upsertMarketSnapshot = async (data: Omit<MarketSnapshot, keyof Document>) => {
  return MarketSnapshotModel.create(data);
};

export const getLatestSnapshot = async (symbol: string) => {
  return MarketSnapshotModel.findOne({ symbol: symbol.toUpperCase() })
    .sort({ timestamp: -1 })
    .lean();
};
