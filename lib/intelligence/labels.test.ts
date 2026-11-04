import { describe, expect, it } from 'vitest';
import { describeEventFacts, freshnessOf } from './labels';

describe('event facts', () => {
  it('describes each event in plain language with its numbers', () => {
    expect(describeEventFacts('VOLUME_SPIKE', { relativeVolume: 2.6 })).toBe('2.6× usual volume for this time of day');
    expect(describeEventFacts('BREAKOUT', { level: 214.2 })).toBe('Closed above $214.20');
    expect(describeEventFacts('BREAKDOWN', { level: 77388 })).toBe('Closed below $77,388.00');
    expect(describeEventFacts('PRICE_MOVE', { changePct: -1.42, windowMinutes: 15, zScore: 3.4 })).toBe('-1.42% in 15 min, 3.4× the usual move');
    expect(describeEventFacts('RSI_EXTREME', { rsiBefore: 66.8, rsi: 70.9 })).toBe('RSI 67 → 71');
  });

  it('degrades to a label when data is missing', () => {
    expect(describeEventFacts('VOLUME_SPIKE', {})).toBe('Volume well above usual');
    expect(describeEventFacts('BREAKOUT', {})).toBe('Resistance breakout');
  });
});

describe('freshness', () => {
  const now = Date.parse('2026-11-04T15:00:00Z');
  const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

  it('never calls old data live', () => {
    expect(freshnessOf(ago(1), now)).toBe('live');
    expect(freshnessOf(ago(5), now)).toBe('recent');
    expect(freshnessOf(ago(10), now)).toBe('delayed');
    expect(freshnessOf(ago(60), now)).toBe('stale');
    expect(freshnessOf(null, now)).toBe('unavailable');
  });
});
