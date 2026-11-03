import { Schema, model, models, type Document, type Model } from 'mongoose';
import type { AssetType } from '@/lib/intelligence/types';

export interface AssetDoc extends Document {
  symbol: string;
  name: string;
  assetType: AssetType;
  exchange?: string;
  currency: string;
  providerSymbols: { finnhub?: string; binance?: string; yahoo?: string };
  sector?: string;
  industry?: string;
  /** Sector ETF used for relative performance, e.g. SMH for semiconductors. */
  benchmark?: string;
  active: boolean;
}

const AssetSchema = new Schema<AssetDoc>(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true, unique: true },
    name: { type: String, required: true, trim: true },
    assetType: { type: String, required: true, enum: ['stock', 'etf', 'crypto'] },
    exchange: { type: String },
    currency: { type: String, default: 'USD' },
    providerSymbols: {
      finnhub: { type: String },
      binance: { type: String },
      yahoo: { type: String },
    },
    sector: { type: String },
    industry: { type: String },
    benchmark: { type: String, uppercase: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const AssetModel: Model<AssetDoc> = (models?.Asset as Model<AssetDoc>) || model<AssetDoc>('Asset', AssetSchema);
