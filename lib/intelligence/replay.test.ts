import { describe, expect, it } from 'vitest';
import { replay } from './replay';
import { BARS_PER_SESSION, cryptoBars, normal, randomWalk, range, stockBars } from './__fixtures__/bars';

const WARMUP = BARS_PER_SESSION * 2;
const BREAKOUT_MINUTE = 200;

/** Two normal sessions, then a range at the opening price that breaks upward on rising volume. */
let rangeCenter = 100;
function breakoutBars({ failAfter }: { failAfter?: number } = {}) {
  return stockBars(3, (args) => {
    if (args.session < 2) return randomWalk()(args);
    if (args.minute === 0) rangeCenter = args.price;
    if (args.minute < BREAKOUT_MINUTE) return range(rangeCenter)(args);
    const t = args.minute - BREAKOUT_MINUTE;
    if (failAfter != null && t >= failAfter) {
      // Gives the move back and closes under the old range
      return { price: Math.max(rangeCenter * 0.994, args.price * (1 - 0.0012)), volumeMultiplier: 1.5 };
    }
    if (t < 30) return { price: args.price * (1 + 0.0009 + 0.0002 * normal(args.rand)), volumeMultiplier: 3.5 };
    return { price: args.price * (1 + 0.0001 * normal(args.rand)), volumeMultiplier: 1.2 };
  });
}

describe('replay: quiet market', () => {
  it('stays quiet across many seeds', () => {
    let strong = 0;
    let total = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const bars = stockBars(3, randomWalk(), seed);
      const { signals } = replay({ symbol: 'QUIET', assetType: 'stock', bars, startIndex: WARMUP });
      total += signals.length;
      strong += signals.filter((s) => s.score.severity === 'high').length;
    }
    // A random walk has no story. Allow the odd weak signal, never a confident one.
    expect(strong).toBe(0);
    expect(total / 12).toBeLessThanOrEqual(1);
  });
});

describe('replay: breakout', () => {
  const result = replay({ symbol: 'NVDA', assetType: 'stock', bars: breakoutBars(), startIndex: WARMUP });
  const bullish = result.signals.filter((s) => s.side === 'up');

  it('turns the burst of events into one bullish signal, not one per event', () => {
    const breakoutEvents = result.events.filter((e) => e.time >= breakoutBars()[WARMUP + BREAKOUT_MINUTE].time && e.direction === 'up');
    expect(breakoutEvents.length).toBeGreaterThanOrEqual(3);
    expect(bullish).toHaveLength(1);
  });

  it('classifies it as a breakout with a key level and several kinds of evidence', () => {
    const [signal] = bullish;
    expect(signal.type).toBe('MOMENTUM_BREAKOUT');
    // The top of the range, a little above its center
    expect(signal.keyLevel! / rangeCenter).toBeGreaterThan(1);
    expect(signal.keyLevel! / rangeCenter).toBeLessThan(1.006);
    expect(signal.score.supportingTypes).toEqual(expect.arrayContaining(['BREAKOUT', 'VOLUME_SPIKE']));
    expect(signal.score.direction).toMatch(/bullish/);
    expect(signal.score.confidence).toBeGreaterThanOrEqual(60);
    expect(signal.relatedEvents.length).toBeGreaterThanOrEqual(3);
  });

  it('confirms the signal and keeps a readable history', () => {
    const statuses = result.updates.filter((u) => u.side === 'up').map((u) => u.status);
    expect(statuses[0]).toBe('DETECTED');
    expect(statuses).toContain('ACTIVE');
    const [signal] = bullish;
    expect(signal.history[0].status).toBe('DETECTED');
    // The session close ends it rather than leaving it open overnight
    expect(['RESOLVED', 'WEAKENING', 'ACTIVE']).toContain(signal.status);
  });

  it('is deterministic', () => {
    const again = replay({ symbol: 'NVDA', assetType: 'stock', bars: breakoutBars(), startIndex: WARMUP });
    expect(again.signals.map((s) => [s.signalId, s.score.strength, s.score.confidence, s.status])).toEqual(
      result.signals.map((s) => [s.signalId, s.score.strength, s.score.confidence, s.status])
    );
  });
});

describe('replay: false breakout', () => {
  it('invalidates the signal when price falls back through the level', () => {
    const { signals } = replay({ symbol: 'FAKE', assetType: 'stock', bars: breakoutBars({ failAfter: 12 }), startIndex: WARMUP });
    const bullish = signals.filter((s) => s.side === 'up');
    expect(bullish).toHaveLength(1);
    expect(bullish[0].status).toBe('INVALIDATED');
    expect(bullish[0].history.at(-1)?.note).toMatch(/moved back through|Opposite/);
  });
});

describe('replay: market context', () => {
  it('calls a move that matches the whole market market-driven', () => {
    const asset = breakoutBars();
    // The benchmark makes the same move at the same time
    const market = asset.map((b) => ({ ...b, volume: (b.volume ?? 0) * 50 }));
    const { signals } = replay({
      symbol: 'NVDA',
      assetType: 'stock',
      bars: asset,
      benchmarks: { market: { symbol: 'SPY', bars: market } },
      startIndex: WARMUP,
    });
    expect(signals.find((s) => s.side === 'up')?.score.context).toBe('market-driven');
  });

  it('calls a move the market did not share asset-specific', () => {
    const asset = breakoutBars();
    const flat = stockBars(3, range(500, 0.0005), 99, 500);
    const { signals } = replay({
      symbol: 'NVDA',
      assetType: 'stock',
      bars: asset,
      benchmarks: { market: { symbol: 'QQQ', bars: flat } },
      startIndex: WARMUP,
    });
    const signal = signals.find((s) => s.side === 'up');
    expect(signal?.score.context).toBe('asset-specific');
    expect(signal?.score.components.relativePerformance).toBeGreaterThan(0.4);
  });
});

describe('replay: crypto', () => {
  it('runs on a 24/7 series without session rules and catches a sharp drop', () => {
    const bars = cryptoBars(1400, (i, price, rand) => {
      if (i < 1200) return { price: price * (1 + 0.0007 * normal(rand)) };
      if (i < 1215) return { price: price * (1 - 0.003), volumeMultiplier: 5 };
      return { price: price * (1 + 0.0003 * normal(rand)) };
    });
    const { signals } = replay({ symbol: 'BTCUSDT', assetType: 'crypto', bars, startIndex: 600 });
    const bearish = signals.filter((s) => s.side === 'down');
    expect(bearish).toHaveLength(1);
    expect(bearish[0].score.direction).toMatch(/bearish/);
    expect(bearish[0].history.some((h) => h.note === 'Session ended')).toBe(false);
  });
});
