import { describe, it, expect } from 'vitest';
import { EVENT_TYPES, type TelemetryEvent } from './types';
import { latestTicks, mergeEvents, signalCounts, timelineEvents } from './view';

const event = (id: string, type: TelemetryEvent['type'], symbol: string, payload = {}): TelemetryEvent => ({
  id,
  type,
  symbol,
  payload,
  createdAt: '2026-11-02T00:00:00.000Z',
});

const tick = (id: string, symbol: string, price: number) => event(id, EVENT_TYPES.PRICE_CHANGED, symbol, { price });
const signal = (id: string, symbol: string, kind: string) =>
  event(id, EVENT_TYPES.SIGNAL_DETECTED, symbol, { kind });

describe('mergeEvents', () => {
  it('keeps newest first and drops duplicates', () => {
    const merged = mergeEvents([tick('b', 'AAPL', 1), tick('a', 'AAPL', 1)], [tick('c', 'AAPL', 2), tick('b', 'AAPL', 1)]);
    expect(merged.map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('caps the list', () => {
    const many = Array.from({ length: 250 }, (_, i) => tick(String(i).padStart(3, '0'), 'AAPL', i));
    expect(mergeEvents([], many)).toHaveLength(200);
  });
});

describe('derived views', () => {
  it('takes the newest tick per symbol', () => {
    const ticks = latestTicks([tick('c', 'AAPL', 3), tick('b', 'AAPL', 2), tick('a', 'MSFT', 1)]);
    expect(ticks.get('AAPL')?.price).toBe(3);
    expect(ticks.get('MSFT')?.price).toBe(1);
  });

  it('leaves ticks off the timeline', () => {
    const items = timelineEvents([tick('b', 'AAPL', 1), signal('a', 'AAPL', 'rsi_cross')]);
    expect(items.map((e) => e.id)).toEqual(['a']);
  });

  it('counts signals by symbol and kind', () => {
    const counts = signalCounts([signal('a', 'AAPL', 'rsi_cross'), signal('b', 'AAPL', 'rsi_cross'), signal('c', 'MSFT', 'volume_spike')]);
    expect(counts.get('AAPL')).toEqual({ rsi_cross: 2 });
    expect(counts.get('MSFT')).toEqual({ volume_spike: 1 });
  });
});
