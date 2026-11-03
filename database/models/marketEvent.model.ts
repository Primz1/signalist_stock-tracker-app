import { Schema, model, models, type Document, type Model } from 'mongoose';
import { MARKET_EVENT_TYPES, type MarketEventRecord } from '@/lib/intelligence/types';

export interface MarketEventDoc extends Document, Omit<MarketEventRecord, 'timestamp'> {
  timestamp: Date;
  expiresAt: Date;
}

const RETENTION_DAYS = 30;

const MarketEventSchema = new Schema<MarketEventDoc>(
  {
    eventId: { type: String, required: true, unique: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    eventType: { type: String, required: true, enum: MARKET_EVENT_TYPES },
    timestamp: { type: Date, required: true },
    direction: { type: String, required: true, enum: ['up', 'down', 'neutral'] },
    severity: { type: String, required: true, enum: ['low', 'medium', 'high'] },
    source: { type: String, required: true, enum: ['detector', 'news', 'market', 'alert', 'signal'] },
    data: { type: Schema.Types.Mixed, default: {} },
    // Unique, so a retried job or overlapping run can't write the same event twice
    dedupeKey: { type: String, required: true, unique: true },
    expiresAt: { type: Date, default: () => new Date(Date.now() + RETENTION_DAYS * 86_400_000) },
  },
  { timestamps: false }
);

MarketEventSchema.index({ symbol: 1, timestamp: -1 });
MarketEventSchema.index({ timestamp: -1 });
MarketEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const MarketEventModel: Model<MarketEventDoc> =
  (models?.MarketEvent as Model<MarketEventDoc>) || model<MarketEventDoc>('MarketEvent', MarketEventSchema);
