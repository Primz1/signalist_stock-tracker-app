import { MarketEventModel } from '@/database/models/marketEvent.model';
import { MarketSnapshotModel } from '@/database/models/marketSnapshot.model';
import { OPEN_SIGNAL_STATUSES, SignalModel } from '@/database/models/signal.model';
import { publishEvent } from '@/lib/events/publisher';
import { EVENT_TYPES } from '@/lib/events/types';
import { logError } from '@/lib/logger';
import { marketData, type CandleSeries } from '@/lib/market/service';
import { isCryptoSymbol, isValidSymbol, normalizeMarketSymbol } from '@/lib/market/symbols';
import { benchmarksFor, ensureAssets, type AssetInfo } from './assets';
import { readContext, type BenchmarkSeries } from './context';
import { applyEventCooldown, detectAt, eventDedupeKey } from './detectors';
import { sessionFor, usEquitySession } from './market-hours';
import { signalTitle } from './scoring';
import { analyticsAt, buildSeries, dailyContextFor, type BarSeries } from './series';
import { IMMEDIATE_PUBLISH_STRENGTH, isConfirmed, stepSignals, type EngineEvent, type EngineSignal } from './signal-engine';
import { fromSignalDocument, toSignalDocument } from './signal-store';
import type { MarketEventType, Provenance } from './types';

/**
 * Production entry point: candles → analytics → detection → correlation → signals,
 * persisted. Runs inside the price poller. Every write is idempotent, so a retried
 * or overlapping run can't duplicate events or signals.
 */

export const PIPELINE_SETTINGS = {
  maxSymbols: 40,
  concurrency: 6,
  stockIntradayDays: 5,
  dailyDays: 20,
  /** Bars evaluated per run. Two-minute runs need 2; the slack covers missed runs. */
  maxBarsPerRun: 30,
  recentEventHours: 3,
  snapshotRetentionHours: 48,
  /** Stocks keep running this long after the close so open signals can resolve. */
  afterCloseMinutes: 15,
} as const;

const P = PIPELINE_SETTINGS;

export type PipelineResult = {
  analyzed: string[];
  skipped: string[];
  events: number;
  /** Signals created or whose status changed. These get AI explanations and alert checks. */
  changed: EngineSignal[];
};

async function inBatches<T, R>(items: T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(run))));
  return out;
}

function stocksActive(now: Date) {
  if (usEquitySession(now) === 'regular') return true;
  return usEquitySession(new Date(now.getTime() - P.afterCloseMinutes * 60_000)) === 'regular';
}

type Loaded = { intraday: CandleSeries; daily: CandleSeries };

async function loadCandles(symbol: string, nowSec: number): Promise<Loaded> {
  const crypto = isCryptoSymbol(symbol);
  const [intraday, daily] = await Promise.all([
    // Binance caps a request at the newest 1,000 bars, about 16 hours of crypto
    marketData.getCandles(symbol, '1m', { from: nowSec - (crypto ? 1 : P.stockIntradayDays) * 86_400, to: nowSec }),
    marketData.getCandles(symbol, '1d', { from: nowSec - P.dailyDays * 86_400, to: nowSec }),
  ]);
  // The newest bar is usually still forming. Only closed bars are analyzed.
  return { intraday: { ...intraday, candles: intraday.candles.filter((c) => c.time + 60 <= nowSec) }, daily };
}

function toEngineEvent(doc: { dedupeKey: string; eventType: string; direction: string; severity: string; timestamp: Date; data: Record<string, unknown> }): EngineEvent {
  return {
    eventId: doc.dedupeKey,
    eventType: doc.eventType as MarketEventType,
    direction: doc.direction as EngineEvent['direction'],
    severity: doc.severity as EngineEvent['severity'],
    time: Math.floor(new Date(doc.timestamp).getTime() / 1000),
    data: doc.data as EngineEvent['data'],
  };
}

async function analyzeSymbol(
  asset: AssetInfo,
  candles: Loaded,
  benchmarks: BenchmarkSeries,
  now: Date
): Promise<{ events: number; changed: EngineSignal[] }> {
  const { symbol } = asset;
  const crypto = asset.assetType === 'crypto';
  const series = buildSeries(symbol, crypto, candles.intraday.candles);
  if (!series.bars.length) return { events: 0, changed: [] };

  const [lastSnapshot, recentDocs, openDocs] = await Promise.all([
    MarketSnapshotModel.findOne({ symbol, timeframe: '1m' }).sort({ timestamp: -1 }).select('timestamp').lean(),
    MarketEventModel.find({ symbol, timestamp: { $gte: new Date(now.getTime() - P.recentEventHours * 3_600_000) } }).lean(),
    SignalModel.find({ symbol, status: { $in: OPEN_SIGNAL_STATUSES } }).lean(),
  ]);

  const lastProcessed = lastSnapshot ? Math.floor(new Date(lastSnapshot.timestamp).getTime() / 1000) : 0;
  const lastIndex = series.bars.length - 1;
  let firstIndex = series.bars.findIndex((b) => b.time > lastProcessed);
  if (firstIndex === -1) return { events: 0, changed: [] };
  // First run for a symbol: start from the latest bar rather than replaying history as news
  if (!lastSnapshot) firstIndex = lastIndex;
  firstIndex = Math.max(firstIndex, lastIndex - P.maxBarsPerRun + 1);

  const recent = recentDocs.map(toEngineEvent);
  const cooldown = new Map<string, number>();
  for (const e of recent) cooldown.set(`${e.eventType}:${e.direction}`, Math.max(cooldown.get(`${e.eventType}:${e.direction}`) ?? 0, e.time));
  let open = openDocs.map(fromSignalDocument);
  const created: EngineEvent[] = [];
  const touched = new Map<string, EngineSignal>(open.map((s) => [s.signalId, s]));
  // Every new history entry is one status change for the live feed, even if the
  // signal changes again later in the same run
  const seenHistory = new Map(open.map((s) => [s.signalId, s.history.length]));
  const transitions: { signal: EngineSignal; entry: EngineSignal['history'][number] }[] = [];

  for (let i = firstIndex; i <= lastIndex; i++) {
    const newEvents = applyEventCooldown(detectAt(series, i), cooldown).map((e) => ({ ...e, eventId: eventDedupeKey(symbol, e) }));
    created.push(...newEvents);
    recent.push(...newEvents);
    const result = stepSignals(open, {
      symbol,
      assetType: asset.assetType,
      series,
      i,
      newEvents,
      recentEvents: recent,
      contextFor: (minutes) => readContext(series, i, benchmarks, minutes),
    });
    open = result.open;
    for (const signal of result.changed) {
      touched.set(signal.signalId, signal);
      signal.history.slice(seenHistory.get(signal.signalId) ?? 0).forEach((entry) => transitions.push({ signal, entry }));
      seenHistory.set(signal.signalId, signal.history.length);
    }
    open.forEach((signal) => touched.set(signal.signalId, signal));
  }

  const lastBar = series.bars[lastIndex];
  const provenance: Provenance = {
    priceSource: candles.intraday.source,
    candleSource: candles.intraday.source,
    fallback: candles.intraday.fallback,
    sourceTimestamp: new Date(lastBar.time * 1000).toISOString(),
    calculatedAt: now.toISOString(),
  };

  if (created.length) {
    await MarketEventModel.insertMany(
      created.map((e) => ({
        eventId: e.eventId,
        dedupeKey: e.eventId,
        symbol,
        eventType: e.eventType,
        timestamp: new Date(e.time * 1000),
        direction: e.direction,
        severity: e.severity,
        source: 'detector',
        data: e.data,
      })),
      { ordered: false }
    ).catch((err) => {
      // Duplicate keys mean an overlapping run already stored these events
      if (err?.code !== 11000 && !err?.writeErrors?.every((w: { code?: number }) => w.code === 11000)) throw err;
    });
  }

  // Open signals are saved every run, not only on material changes, so the next run
  // resumes exactly where this one stopped. Replay and production then agree bar for bar.
  if (touched.size) {
    await SignalModel.bulkWrite(
      [...touched.values()].map((signal) => ({
        updateOne: { filter: { signalId: signal.signalId }, update: { $set: toSignalDocument(signal, provenance) }, upsert: true },
      })),
      { ordered: false }
    );
  }

  const daily = dailyContextFor(crypto, candles.daily.candles, lastBar.time);
  const analytics = analyticsAt(series, lastIndex, daily);
  await MarketSnapshotModel.create({
    symbol,
    price: lastBar.close,
    volume: lastBar.volume,
    changePercent: analytics.change1d,
    timeframe: '1m',
    session: sessionFor(crypto, new Date(lastBar.time * 1000)),
    provenance,
    ...analytics,
    timestamp: new Date(lastBar.time * 1000),
    expiresAt: new Date(now.getTime() + P.snapshotRetentionHours * 3_600_000),
  });

  // Only creation and status changes reach the live feed, and only for confirmed signals.
  // A weak DETECTED entry stays quiet; the feed hears about it when it turns ACTIVE.
  const published = transitions.filter(({ signal, entry }) => {
    const latest = touched.get(signal.signalId)!;
    if (!isConfirmed(latest)) return false;
    return entry.status !== 'DETECTED' || latest.peakStrength >= IMMEDIATE_PUBLISH_STRENGTH;
  });
  for (const { signal, entry } of published) {
    await publishEvent({
      type: EVENT_TYPES.SIGNAL_UPDATED,
      payload: {
        signalId: signal.signalId,
        symbol,
        title: signalTitle(signal.type, signal.score.direction),
        type: signal.type,
        direction: signal.score.direction,
        status: entry.status,
        strength: signal.score.strength,
        confidence: signal.score.confidence,
        note: entry.note,
        timestamp: new Date(entry.at * 1000).toISOString(),
      },
    });
  }

  const changed = Array.from(new Set(published.map((t) => t.signal.signalId))).map((id) => touched.get(id)!);
  return { events: created.length, changed };
}

export async function runIntelligencePipeline(symbols: string[], now = new Date()): Promise<PipelineResult> {
  const nowSec = Math.floor(now.getTime() / 1000);
  const unique = Array.from(new Set(symbols.map(normalizeMarketSymbol))).filter(isValidSymbol).sort();
  const runStocks = stocksActive(now);
  const wanted = unique.filter((s) => runStocks || isCryptoSymbol(s)).slice(0, P.maxSymbols);
  const skipped = unique.filter((s) => !wanted.includes(s));
  if (!wanted.length) return { analyzed: [], skipped, events: 0, changed: [] };

  const assets = await ensureAssets(wanted);
  const benchmarkSymbols = new Set<string>();
  for (const symbol of wanted) {
    const b = benchmarksFor(assets.get(symbol)!);
    if (b.market) benchmarkSymbols.add(b.market);
    if (b.sector) benchmarkSymbols.add(b.sector);
  }

  const toLoad = Array.from(new Set([...wanted, ...benchmarkSymbols]));
  const loaded = new Map<string, Loaded>();
  await inBatches(toLoad, P.concurrency, async (symbol) => {
    try {
      loaded.set(symbol, await loadCandles(symbol, nowSec));
    } catch (err) {
      logError('pipeline candles failed', { symbol, error: err instanceof Error ? err.message : String(err) });
    }
  });

  const seriesCache = new Map<string, BarSeries>();
  const seriesOf = (symbol?: string) => {
    if (!symbol) return undefined;
    const candles = loaded.get(symbol)?.intraday.candles;
    if (!candles?.length) return undefined;
    if (!seriesCache.has(symbol)) seriesCache.set(symbol, buildSeries(symbol, isCryptoSymbol(symbol), candles));
    return seriesCache.get(symbol);
  };

  const analyzed: string[] = [];
  let events = 0;
  const changed: EngineSignal[] = [];
  for (const symbol of wanted) {
    const candles = loaded.get(symbol);
    if (!candles?.intraday.candles.length) {
      skipped.push(symbol);
      continue;
    }
    try {
      const b = benchmarksFor(assets.get(symbol)!);
      const result = await analyzeSymbol(assets.get(symbol)!, candles, { market: seriesOf(b.market), sector: seriesOf(b.sector) }, now);
      analyzed.push(symbol);
      events += result.events;
      changed.push(...result.changed);
    } catch (err) {
      // One symbol's failure must not stop the rest
      skipped.push(symbol);
      logError('pipeline symbol failed', { symbol, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { analyzed, skipped, events, changed };
}
