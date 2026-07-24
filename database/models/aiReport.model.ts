import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface AiReportSource {
  title: string;
  url?: string;
  type: 'news' | 'filing' | 'market' | 'indicator';
}

export interface AiReport extends Document {
  userId?: string;
  symbol: string;
  query?: string;
  summary: string;
  confidence: number;
  signals?: { label: string; type: 'bullish' | 'bearish' | 'neutral' | 'warning' }[];
  sources: AiReportSource[];
  createdAt: Date;
}

const AiReportSchema = new Schema<AiReport>(
  {
    userId: { type: String, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    query: { type: String, trim: true },
    summary: { type: String, required: true },
    confidence: { type: Number, default: 0.7 },
    signals: { type: Schema.Types.Mixed },
    sources: { type: Schema.Types.Mixed, default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

AiReportSchema.index({ symbol: 1, createdAt: -1 });
AiReportSchema.index({ userId: 1, createdAt: -1 });
AiReportSchema.index({ createdAt: -1 });

export const AiReportModel: Model<AiReport> =
  (models?.AiReport as Model<AiReport>) || model<AiReport>('AiReport', AiReportSchema);

export const createAiReport = async (data: {
  userId?: string;
  symbol: string;
  query?: string;
  summary: string;
  confidence?: number;
  signals?: AiReport['signals'];
  sources?: AiReportSource[];
}) => {
  return AiReportModel.create(data);
};

export const getLatestAiReport = async (symbol: string, userId?: string) => {
  const filter: Record<string, string> = { symbol: symbol.toUpperCase() };
  if (userId) filter.userId = userId;
  return AiReportModel.findOne(filter).sort({ createdAt: -1 }).lean();
};

export const listAiReports = async (userId: string, limit = 20) => {
  return AiReportModel.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
};
