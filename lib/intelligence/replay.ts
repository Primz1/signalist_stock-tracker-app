import type { Candle } from '@/lib/market/providers/types';
import { applyEventCooldown, detectAt, eventDedupeKey, type DetectedEvent } from './detectors';
import { readContext, type BenchmarkSeries } from './context';
import { buildSeries } from './series';
import { stepSignals, type EngineEvent, type EngineSignal } from './signal-engine';
import type { AssetType } from './types';

/**
 * Feeds historical bars through analytics → detection → correlation → signals, one bar
 * at a time, using the same code as production. Used by tests and `npm run replay`.
 */

export type ReplayInput = {
  symbol: string;
  assetType: AssetType;
  bars: Candle[];
  benchmarks?: { market?: { symbol: string; bars: Candle[] }; sector?: { symbol: string; bars: Candle[] } };
  /** Only bars from this index on are evaluated. Earlier bars warm up the indicators. */
  startIndex?: number;
};

export type ReplayResult = {
  events: EngineEvent[];
  /** Every version of every signal that changed, in order. */
  updates: EngineSignal[];
  /** The final state of each signal. */
  signals: EngineSignal[];
};

const RECENT_EVENT_HOURS = 3;

export function replay(input: ReplayInput): ReplayResult {
  const crypto = input.assetType === 'crypto';
  const series = buildSeries(input.symbol, crypto, input.bars);
  const benchmarks: BenchmarkSeries = {
    market: input.benchmarks?.market && buildSeries(input.benchmarks.market.symbol, crypto, input.benchmarks.market.bars),
    sector: input.benchmarks?.sector && buildSeries(input.benchmarks.sector.symbol, crypto, input.benchmarks.sector.bars),
  };

  const events: EngineEvent[] = [];
  const updates: EngineSignal[] = [];
  const latest = new Map<string, EngineSignal>();
  const cooldown = new Map<string, number>();
  let open: EngineSignal[] = [];

  for (let i = input.startIndex ?? 0; i < series.bars.length; i++) {
    const detected: DetectedEvent[] = applyEventCooldown(detectAt(series, i), cooldown);
    const newEvents = detected.map((e) => ({ ...e, eventId: eventDedupeKey(input.symbol, e) }));
    events.push(...newEvents);
    const now = series.bars[i].time;
    const recentEvents = events.filter((e) => now - e.time <= RECENT_EVENT_HOURS * 3600);

    const result = stepSignals(open, {
      symbol: input.symbol,
      assetType: input.assetType,
      series,
      i,
      newEvents,
      recentEvents,
      contextFor: (minutes) => readContext(series, i, benchmarks, minutes),
    });
    open = result.open;
    for (const signal of result.changed) {
      updates.push(signal);
      latest.set(signal.signalId, signal);
    }
    // Open signals keep rescoring between recorded changes, as production saves them every run
    for (const signal of open) latest.set(signal.signalId, signal);
  }

  return { events, updates, signals: [...latest.values()] };
}
