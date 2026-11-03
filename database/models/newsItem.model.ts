import { Schema, model, models, type Document, type Model } from 'mongoose';

/** Normalized financial news. Stored so a signal can cite exactly what was published around it. */
export interface NewsItemDoc extends Document {
  /** sha256 of the URL, so the same story from two fetches is stored once. */
  newsId: string;
  headline: string;
  publisher: string;
  url: string;
  publishedAt: Date;
  symbols: string[];
  summary?: string;
  source: 'FINNHUB';
  expiresAt: Date;
}

const RETENTION_DAYS = 14;

const NewsItemSchema = new Schema<NewsItemDoc>(
  {
    newsId: { type: String, required: true, unique: true },
    headline: { type: String, required: true, trim: true },
    publisher: { type: String, required: true, trim: true },
    url: { type: String, required: true },
    publishedAt: { type: Date, required: true },
    symbols: { type: [String], default: [] },
    summary: { type: String },
    source: { type: String, required: true, enum: ['FINNHUB'] },
    expiresAt: { type: Date, default: () => new Date(Date.now() + RETENTION_DAYS * 86_400_000) },
  },
  { timestamps: false }
);

NewsItemSchema.index({ symbols: 1, publishedAt: -1 });
NewsItemSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const NewsItemModel: Model<NewsItemDoc> =
  (models?.NewsItem as Model<NewsItemDoc>) || model<NewsItemDoc>('NewsItem', NewsItemSchema);
