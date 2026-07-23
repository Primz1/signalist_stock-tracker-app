import { Redis } from '@upstash/redis';
import { EVENT_TYPES, type PriceChangedEvent } from './types';
import { createEvent } from '@/database/models/event.model';
import { connectToDatabase } from '@/database/mongoose';

const STREAM_KEY = 'signalist:events';

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function publishPriceChanged(event: PriceChangedEvent) {
  await connectToDatabase();
  await createEvent({
    type: EVENT_TYPES.PRICE_CHANGED,
    symbol: event.symbol,
    payload: event as unknown as Record<string, unknown>,
  });

  const redis = getRedis();
  if (!redis) return;

  await redis.xadd(STREAM_KEY, '*', {
    type: EVENT_TYPES.PRICE_CHANGED,
    data: JSON.stringify(event),
  });
}

export async function getRecentEvents(limit = 50) {
  const redis = getRedis();
  if (!redis) {
    await connectToDatabase();
    const { EventModel } = await import('@/database/models/event.model');
    return EventModel.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  }

  const entries = await redis.xrange(STREAM_KEY, '-', '+', limit);
  if (!Array.isArray(entries)) return [];

  return entries.map((entry) => {
    const fields = entry[1];
    if (typeof fields === 'object' && fields !== null && !Array.isArray(fields)) {
      return fields as Record<string, unknown>;
    }
    return { raw: fields };
  });
}
