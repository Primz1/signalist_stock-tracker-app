import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface PortfolioHolding {
  symbol: string;
  company: string;
  quantity: number;
  avgCost: number;
}

export interface Portfolio extends Document {
  userId: string;
  name: string;
  cash: number;
  initialCash: number;
  holdings: PortfolioHolding[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PortfolioTrade extends Document {
  portfolioId: string;
  userId: string;
  symbol: string;
  company: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  fees: number;
  note?: string;
  /** Avg cost at time of sale — immutable for realized P/L */
  avgCostAtSale?: number;
  /** Qty × (sell price − avgCostAtSale); sells only */
  realizedPl?: number;
  undoneAt?: Date;
  timestamp: Date;
}

const PortfolioSchema = new Schema<Portfolio>(
  {
    userId: { type: String, required: true },
    name: { type: String, default: 'Paper Portfolio', trim: true },
    cash: { type: Number, required: true, default: 10000 },
    initialCash: { type: Number, required: true, default: 10000 },
    holdings: {
      type: [
        {
          symbol: { type: String, uppercase: true, trim: true },
          company: { type: String, trim: true },
          quantity: { type: Number, required: true },
          avgCost: { type: Number, required: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

PortfolioSchema.index({ userId: 1 }, { unique: true });

const PortfolioTradeSchema = new Schema<PortfolioTrade>(
  {
    portfolioId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    company: { type: String, required: true, trim: true },
    side: { type: String, required: true, enum: ['buy', 'sell'] },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    total: { type: Number, required: true },
    fees: { type: Number, default: 0 },
    note: { type: String, trim: true },
    avgCostAtSale: { type: Number },
    realizedPl: { type: Number },
    undoneAt: { type: Date },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

PortfolioTradeSchema.index({ userId: 1, timestamp: -1 });
PortfolioTradeSchema.index({ userId: 1, symbol: 1, timestamp: -1 });

export const PortfolioModel: Model<Portfolio> =
  (models?.Portfolio as Model<Portfolio>) || model<Portfolio>('Portfolio', PortfolioSchema);

export const PortfolioTradeModel: Model<PortfolioTrade> =
  (models?.PortfolioTrade as Model<PortfolioTrade>) ||
  model<PortfolioTrade>('PortfolioTrade', PortfolioTradeSchema);

export const getOrCreatePortfolio = async (userId: string) => {
  const existing = await PortfolioModel.findOne({ userId }).lean();
  if (existing) return existing;
  const created = await PortfolioModel.create({ userId });
  return created.toObject();
};
