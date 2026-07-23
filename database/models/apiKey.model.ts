import { Schema, model, models, type Document, type Model } from 'mongoose';
import crypto from 'crypto';

export interface ApiKey extends Document {
  userId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  usageCount: number;
  rateLimit: number;
  lastUsedAt?: Date;
  createdAt: Date;
}

const ApiKeySchema = new Schema<ApiKey>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    keyHash: { type: String, required: true, unique: true },
    keyPrefix: { type: String, required: true },
    usageCount: { type: Number, default: 0 },
    rateLimit: { type: Number, default: 1000 },
    lastUsedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const ApiKeyModel: Model<ApiKey> =
  (models?.ApiKey as Model<ApiKey>) || model<ApiKey>('ApiKey', ApiKeySchema);

export const hashApiKey = (key: string) =>
  crypto.createHash('sha256').update(key).digest('hex');

export const generateApiKey = () => {
  const raw = `sig_${crypto.randomBytes(24).toString('hex')}`;
  return {
    raw,
    keyHash: hashApiKey(raw),
    keyPrefix: raw.slice(0, 12),
  };
};

export const createApiKey = async (userId: string, name: string) => {
  const { raw, keyHash, keyPrefix } = generateApiKey();
  await ApiKeyModel.create({ userId, name, keyHash, keyPrefix });
  return { raw, keyPrefix };
};

export const listApiKeys = async (userId: string) => {
  return ApiKeyModel.find({ userId }, { keyHash: 0 }).sort({ createdAt: -1 }).lean();
};

export const validateApiKey = async (rawKey: string) => {
  const keyHash = hashApiKey(rawKey);
  const key = await ApiKeyModel.findOneAndUpdate(
    { keyHash },
    { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } },
    { new: true }
  ).lean();
  return key;
};
