import { describe, it, expect } from 'vitest';
import { applyCooldown, detectSignals, SIGNAL_COOLDOWN_MS, type SignalSnapshot } from './signals';

const flat = (price: number, count: number): SignalSnapshot[] =>
  Array.from({ length: count }, (_, i) => ({ price: price + (i % 2 ? 0.01 : -0.01) }));

const kinds = (history: SignalSnapshot[]) => detectSignals(history).map((s) => s.kind);

describe('detectSignals', () => {
  it('needs two snapshots', () => {
    expect(detectSignals([{ price: 100 }])).toEqual([]);
  });

  it('flags a move far outside the recent range', () => {
    const [signal] = detectSignals([...flat(100, 12), { price: 104 }]);
    expect(signal.kind).toBe('unusual_move');
    expect(signal.direction).toBe('up');
  });

  it('ignores normal noise', () => {
    expect(kinds([...flat(100, 12), { price: 100.05 }])).toEqual([]);
  });

  it('waits for enough history before judging a move', () => {
    expect(kinds([...flat(100, 3), { price: 110 }])).toEqual([]);
  });

  it('fires RSI only on the crossing', () => {
    const at = (rsi14: number): SignalSnapshot => ({ price: 100, indicators: { rsi14 } });
    expect(kinds([at(65), at(72)])).toEqual(['rsi_cross']);
    expect(kinds([at(72), at(75)])).toEqual([]);
    expect(detectSignals([at(35), at(28)])[0].direction).toBe('down');
  });

  it('fires MACD when the histogram changes sign', () => {
    const at = (histogram: number): SignalSnapshot => ({ price: 100, indicators: { macd: { histogram } } });
    expect(detectSignals([at(-0.2), at(0.1)])[0].direction).toBe('up');
    expect(kinds([at(0.1), at(0.2)])).toEqual([]);
  });

  it('fires Bollinger only when the price leaves the band', () => {
    const bollinger = { upper: 110, lower: 90 };
    const at = (price: number): SignalSnapshot => ({ price, indicators: { bollinger } });
    expect(kinds([at(109), at(111)])).toEqual(['bollinger_break']);
    expect(kinds([at(111), at(112)])).toEqual([]);
    expect(detectSignals([at(91), at(89)])[0].direction).toBe('down');
  });

  it('fires a volume spike once', () => {
    const candles = (last: number) => [...Array.from({ length: 20 }, () => ({ volume: 100 })), { volume: last }];
    const at = (last: number): SignalSnapshot => ({ price: 100, ohlcv: candles(last) });
    expect(kinds([at(100), at(300)])).toEqual(['volume_spike']);
    expect(kinds([at(300), at(320)])).toEqual([]);
  });
});

describe('applyCooldown', () => {
  const signal = { kind: 'rsi_cross', direction: 'up', label: '', detail: '' } as const;
  const now = 1_000_000_000;

  it('drops a kind that fired recently', () => {
    expect(applyCooldown([signal], new Map([['rsi_cross', now - 1000]]), now)).toEqual([]);
  });

  it('allows it again after the cooldown', () => {
    expect(applyCooldown([signal], new Map([['rsi_cross', now - SIGNAL_COOLDOWN_MS]]), now)).toEqual([signal]);
  });
});
