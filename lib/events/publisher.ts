import { Redis } from '@upstash/redis';
import { Types } from 'mongoose';
import {
  EVENT_TYPES,
  type PriceChangedEvent,
  type SignalKind,
  type TelemetryEvent,
  type TelemetryEventInput,
} from './types';
import { createEvent, EventModel } from '@/database/models/event.model';
import { connectToDatabase } from '@/database/mongoose';

const STREAM_KEY = 'signalist:events';
const HOUR_MS = 60 * 60 * 1000;

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/** Price ticks are high-volume, so they expire sooner than signals and alerts. */
const retentionMs = (type: TelemetryEventInput['type']) =>
  type === EVENT_TYPES.PRICE_CHANGED ? 24 * HOUR_MS : 7 * 24 * HOUR_MS;

export async function publishEvent(event: TelemetryEventInput) {
  await connectToDatabase();
  const doc = await createEvent({
    type: event.type,
    symbol: event.payload.symbol,
    userId: event.userId,
    payload: event.payload as unknown as Record<string, unknown>,
    expiresAt: new Date(Date.now() + retentionMs(event.type)),
  });

  const redis = getRedis();
  if (redis) {
    await redis.xadd(STREAM_KEY, '*', { type: event.type, data: JSON.stringify(event.payload) });
  }

  return doc;
}

export async function publishPriceChanged(event: PriceChangedEvent) {
  return publishEvent({ type: EVENT_TYPES.PRICE_CHANGED, payload: event });
}

type RecentEventsOptions = {
  /** Include this user's private events. Other users' private events are never returned. */
  userId: string;
  /** Limit public events to these symbols. */
  symbols: string[];
  /** Only return events newer than this event id. */
  afterId?: string;
  limit?: number;
};

/** Newest first. Reads Mongo rather than Redis because filtering needs its indexes. */
export async function getRecentEvents({
  userId,
  symbols,
  afterId,
  limit = 50,
}: RecentEventsOptions): Promise<TelemetryEvent[]> {
  await connectToDatabase();
  const filter: Record<string, unknown> = {
    $or: [{ userId }, { userId: { $exists: false }, symbol: { $in: symbols } }],
  };
  if (afterId && Types.ObjectId.isValid(afterId)) filter._id = { $gt: new Types.ObjectId(afterId) };

  const docs = await EventModel.find(filter).sort({ _id: -1 }).limit(limit).lean();
  return docs.map((doc) => ({
    id: String(doc._id),
    type: doc.type as TelemetryEvent['type'],
    symbol: doc.symbol,
    payload: doc.payload,
    createdAt: new Date(doc.createdAt).toISOString(),
  }));
}

/** Latest published price per symbol, used to skip unchanged ticks and fill the live strip. */
export async function getLatestPrices(symbols: string[]) {
  await connectToDatabase();
  const rows = await EventModel.aggregate<{ _id: string; payload: PriceChangedEvent }>([
    { $match: { type: EVENT_TYPES.PRICE_CHANGED, symbol: { $in: symbols } } },
    { $sort: { _id: -1 } },
    { $group: { _id: '$symbol', payload: { $first: '$payload' } } },
  ]);
  return new Map(rows.map((row) => [row._id, row.payload]));
}

/** When each signal kind last fired for a symbol, for the cooldown. */
export async function getLastSignalTimes(symbol: string) {
  await connectToDatabase();
  const rows = await EventModel.aggregate<{ _id: SignalKind; at: Date }>([
    { $match: { type: EVENT_TYPES.SIGNAL_DETECTED, symbol } },
    { $group: { _id: '$payload.kind', at: { $max: '$createdAt' } } },
  ]);
  return new Map(rows.map((row) => [row._id, new Date(row.at).getTime()]));
}
