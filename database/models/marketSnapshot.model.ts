import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface MarketSnapshot extends Document {
  symbol: string;
  price: number;
  volume?: number;
  changePercent?: number;
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
}

const MarketSnapshotSchema = new Schema<MarketSnapshot>(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    price: { type: Number, required: true },
    volume: { type: Number },
    changePercent: { type: Number },
    ohlcv: { type: Schema.Types.Mixed },
    indicators: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

MarketSnapshotSchema.index({ symbol: 1, timestamp: -1 });

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
