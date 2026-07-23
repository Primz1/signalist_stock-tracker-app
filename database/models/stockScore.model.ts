import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface ScoreFactors {
  technical: number;
  news: number;
  momentum: number;
  risk: number;
  earnings: number;
}

export interface StockScore extends Document {
  symbol: string;
  score: number;
  factors: ScoreFactors;
  updatedAt: Date;
}

const StockScoreSchema = new Schema<StockScore>(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true, unique: true },
    score: { type: Number, required: true },
    factors: {
      technical: { type: Number, default: 0 },
      news: { type: Number, default: 0 },
      momentum: { type: Number, default: 0 },
      risk: { type: Number, default: 0 },
      earnings: { type: Number, default: 0 },
    },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const StockScoreModel: Model<StockScore> =
  (models?.StockScore as Model<StockScore>) || model<StockScore>('StockScore', StockScoreSchema);

export const upsertStockScore = async (symbol: string, score: number, factors: ScoreFactors) => {
  return StockScoreModel.findOneAndUpdate(
    { symbol: symbol.toUpperCase() },
    { $set: { score, factors, updatedAt: new Date() } },
    { upsert: true, new: true }
  ).lean();
};

export const getStockScore = async (symbol: string) => {
  return StockScoreModel.findOne({ symbol: symbol.toUpperCase() }).lean();
};
