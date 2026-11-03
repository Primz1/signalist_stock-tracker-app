import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import type { Candle } from '@/lib/market/providers/types';
import { normal, randomWalk, range, stockBars } from './__fixtures__/bars';
import { replay } from './replay';

/**
 * market data → snapshot → analytics → event → signal, through the real pipeline and
 * models against an in-memory MongoDB. Only the vendor calls are replaced.
 */

let center = 100;
const bars: Candle[] = stockBars(3, (args) => {
  if (args.session < 2) return randomWalk()(args);
  if (args.minute === 0) center = args.price;
  if (args.minute < 200) return range(center)(args);
  if (args.minute < 230) return { price: args.price * (1 + 0.0009 + 0.0002 * normal(args.rand)), volumeMultiplier: 3.5 };
  return { price: args.price * (1 + 0.0001 * normal(args.rand)), volumeMultiplier: 1.2 };
});
const flatMarket = stockBars(3, range(500, 0.0005), 99, 500);
const breakoutTime = bars[2 * 390 + 200].time;

function daily(source: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (let s = 0; s < source.length; s += 390) {
    const day = source.slice(s, s + 390);
    out.push({
      time: day[0].time,
      open: day[0].open,
      high: Math.max(...day.map((b) => b.high)),
      low: Math.min(...day.map((b) => b.low)),
      close: day.at(-1)!.close,
      volume: day.reduce((a, b) => a + (b.volume ?? 0), 0),
    });
  }
  return out;
}

vi.mock('@/lib/logger', () => ({ logError: vi.fn(), logInfo: vi.fn() }));
vi.mock('@/lib/market/service', () => ({
  marketData: {
    getProfile: vi.fn(async () => ({ name: 'NVIDIA Corp', exchange: 'NASDAQ', industry: 'Semiconductors', currency: 'USD' })),
    getCandles: vi.fn(async (symbol: string, timeframe: string, range: { from: number; to: number }) => {
      const source = symbol === 'NVDA' ? bars : flatMarket;
      // Bars up to "now", including the one still forming, like a real provider
      const visible = source.filter((b) => b.time <= range.to && b.time >= range.from);
      return {
        symbol,
        timeframe,
        candles: timeframe === '1d' ? daily(source).filter((d) => d.time <= range.to) : visible,
        source: 'YAHOO',
        fallback: false,
        fetchedAt: new Date(range.to * 1000).toISOString(),
      };
    }),
  },
}));

let mongo: MongoMemoryServer;
let pipeline: typeof import('./pipeline');
let models: {
  Signal: typeof import('@/database/models/signal.model').SignalModel;
  Event: typeof import('@/database/models/marketEvent.model').MarketEventModel;
  Snapshot: typeof import('@/database/models/marketSnapshot.model').MarketSnapshotModel;
  App: typeof import('@/database/models/event.model').EventModel;
};

beforeAll(async () => {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  mongo = await MongoMemoryServer.create();
  // database/mongoose reads the URI when first imported
  process.env.MONGODB_URI = mongo.getUri('signalist_test');
  const { connectToDatabase } = await import('@/database/mongoose');
  await connectToDatabase();
  pipeline = await import('./pipeline');
  models = {
    Signal: (await import('@/database/models/signal.model')).SignalModel,
    Event: (await import('@/database/models/marketEvent.model')).MarketEventModel,
    Snapshot: (await import('@/database/models/marketSnapshot.model')).MarketSnapshotModel,
    App: (await import('@/database/models/event.model')).EventModel,
  };
  await Promise.all(Object.values(models).map((m) => m.init()));
}, 120_000);

afterAll(async () => {
  const mongoose = (await import('mongoose')).default;
  await mongoose.disconnect();
  await mongo?.stop();
});

describe('intelligence pipeline', () => {
  const start = breakoutTime - 30 * 60;
  const end = breakoutTime + 60 * 60;

  it('runs every two minutes and builds one breakout signal from the burst of events', async () => {
    for (let t = start; t <= end; t += 120) {
      await pipeline.runIntelligencePipeline(['NVDA'], new Date(t * 1000));
    }
    const signals = await models.Signal.find({ symbol: 'NVDA' }).lean();
    const bullish = signals.filter((s) => s.side === 'up');
    expect(bullish).toHaveLength(1);
    expect(bullish[0].type).toBe('MOMENTUM_BREAKOUT');
    expect(['ACTIVE', 'WEAKENING']).toContain(bullish[0].status);
    expect(bullish[0].relatedEvents.length).toBeGreaterThanOrEqual(3);
    expect(bullish[0].provenance).toMatchObject({ candleSource: 'YAHOO', fallback: false });
    expect(bullish[0].context).toBe('asset-specific');
    expect(bullish[0].evidence.map((e) => e.key)).toEqual(expect.arrayContaining(['price', 'relativeVolume', 'rsi', 'level', 'market']));
  }, 120_000);

  it('stores one snapshot per run with provenance and analytics', async () => {
    const latest = await models.Snapshot.findOne({ symbol: 'NVDA' }).sort({ timestamp: -1 }).lean();
    expect(latest?.timeframe).toBe('1m');
    expect(latest?.session).toBe('regular');
    expect(latest?.provenance?.candleSource).toBe('YAHOO');
    expect(latest?.rsi).toBeGreaterThan(0);
    expect(latest?.vwap).toBeGreaterThan(0);
    // The newest bar was still forming, so the snapshot is the bar before "now"
    expect(new Date(latest!.timestamp).getTime() / 1000).toBeLessThan(end);
  });

  it('is idempotent: rerunning the same minute writes nothing new', async () => {
    const before = await Promise.all([models.Event.countDocuments(), models.Signal.countDocuments()]);
    await pipeline.runIntelligencePipeline(['NVDA'], new Date(end * 1000));
    await pipeline.runIntelligencePipeline(['NVDA'], new Date(end * 1000));
    const after = await Promise.all([models.Event.countDocuments(), models.Signal.countDocuments()]);
    expect(after).toEqual(before);
  });

  it('publishes creation and status changes to the live feed, not every tick', async () => {
    const feed = await models.App.find({ type: 'market.signal_updated', symbol: 'NVDA' }).sort({ _id: 1 }).lean();
    const statuses = feed.map((f) => (f.payload as { status: string }).status);
    expect(statuses[0]).toBe('DETECTED');
    expect(statuses).toContain('ACTIVE');
    expect(feed.length).toBeLessThan(6);
  });

  it('matches the replay harness bar for bar', async () => {
    const stored = await models.Signal.findOne({ symbol: 'NVDA', side: 'up' }).lean();
    const firstEvaluated = bars.findIndex((b) => b.time + 60 > start) - 1;
    const replayed = replay({
      symbol: 'NVDA',
      assetType: 'stock',
      bars: bars.filter((b) => b.time + 60 <= end),
      benchmarks: { market: { symbol: 'SPY', bars: flatMarket }, sector: { symbol: 'SMH', bars: flatMarket } },
      startIndex: firstEvaluated,
    });
    const match = replayed.signals.find((s) => s.side === 'up');
    expect(match?.signalId).toBe(stored?.signalId);
    expect(match?.score.strength).toBe(stored?.strength);
  });

  it('stays quiet for stocks while the market is closed', async () => {
    const saturday = new Date('2026-10-31T15:00:00Z');
    const result = await pipeline.runIntelligencePipeline(['NVDA'], saturday);
    expect(result.analyzed).toEqual([]);
    expect(result.skipped).toEqual(['NVDA']);
  });
});
