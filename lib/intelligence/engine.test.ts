import { describe, expect, it } from 'vitest';
import { classifyContext } from './context';
import { applyEventCooldown, eventDedupeKey, type DetectedEvent } from './detectors';
import { usEquitySession } from './market-hours';
import { scoreSignal } from './scoring';
import { buildSeries } from './series';
import { randomWalk, stockBars } from './__fixtures__/bars';

describe('market hours', () => {
  const at = (iso: string) => usEquitySession(new Date(iso));

  it('knows the regular session across the November clock change', () => {
    expect(at('2026-10-30T13:45:00Z')).toBe('regular'); // 09:45 EDT
    expect(at('2026-11-02T14:45:00Z')).toBe('regular'); // 09:45 EST
    expect(at('2026-11-02T14:15:00Z')).toBe('pre');
    expect(at('2026-11-02T21:30:00Z')).toBe('post');
    expect(at('2026-11-03T02:00:00Z')).toBe('closed');
  });

  it('closes on weekends and holidays, and early on half days', () => {
    expect(at('2026-10-31T15:00:00Z')).toBe('closed'); // Saturday
    expect(at('2026-11-26T16:00:00Z')).toBe('closed'); // Thanksgiving
    expect(at('2026-11-27T17:30:00Z')).toBe('regular'); // 12:30, before the 13:00 close
    expect(at('2026-11-27T18:30:00Z')).toBe('post');
  });
});

describe('market context', () => {
  const read = (asset: number, market?: number, sector?: number) =>
    classifyContext({ assetChangePct: asset, marketChangePct: market, sectorChangePct: sector, windowMinutes: 60 });

  it('separates market, sector and asset-specific moves', () => {
    expect(read(1.1, 0.9)).toBe('market-driven');
    expect(read(4.2, 0.8, 1.1)).toBe('asset-specific');
    expect(read(1.6, 0.1, 1.4)).toBe('sector-driven');
    expect(read(0.6, 0.1)).toBe('mixed');
  });

  it("doesn't credit a flat market with driving anything", () => {
    expect(read(0.2, 0.05)).toBe('mixed');
  });

  it('says unknown without a benchmark', () => {
    expect(read(3)).toBe('unknown');
  });
});

describe('event cooldown and keys', () => {
  const event = (time: number, eventType: DetectedEvent['eventType'] = 'VOLUME_SPIKE'): DetectedEvent => ({
    eventType,
    direction: 'up',
    severity: 'medium',
    time,
    data: {},
  });

  it('drops a repeat inside the cooldown and keeps one after it', () => {
    const fired = new Map<string, number>();
    expect(applyEventCooldown([event(0)], fired)).toHaveLength(1);
    expect(applyEventCooldown([event(10 * 60)], fired)).toHaveLength(0);
    expect(applyEventCooldown([event(31 * 60)], fired)).toHaveLength(1);
  });

  it('gives the same event the same key on every run', () => {
    expect(eventDedupeKey('NVDA', event(100))).toBe(eventDedupeKey('NVDA', event(100)));
    expect(eventDedupeKey('NVDA', event(100))).not.toBe(eventDedupeKey('NVDA', event(160)));
  });
});

describe('scoring', () => {
  const bars = stockBars(2, randomWalk(), 3);
  const series = buildSeries('TEST', false, bars);
  const i = bars.length - 1;
  const context = { assetChangePct: 0.4, marketChangePct: 0.1, windowMinutes: 30 };
  const ev = (eventType: DetectedEvent['eventType'], severity: DetectedEvent['severity'] = 'medium'): DetectedEvent => ({
    eventType,
    direction: 'up',
    severity,
    time: bars[i].time,
    data: {},
  });

  it('keeps confidence separate from strength: more agreeing evidence raises confidence', () => {
    const one = scoreSignal({ direction: 'up', events: [ev('PRICE_MOVE', 'high')], series, i, context });
    const many = scoreSignal({
      direction: 'up',
      events: [ev('PRICE_MOVE', 'high'), ev('VOLUME_SPIKE'), ev('BREAKOUT'), ev('MOMENTUM_ACCELERATION')],
      series,
      i,
      context,
    });
    expect(many.confidence).toBeGreaterThan(one.confidence + 15);
  });

  it('lowers confidence when evidence points the other way', () => {
    const agree = scoreSignal({ direction: 'up', events: [ev('PRICE_MOVE'), ev('VOLUME_SPIKE')], series, i, context });
    const disagree = scoreSignal({
      direction: 'up',
      events: [ev('PRICE_MOVE'), ev('VOLUME_SPIKE'), { ...ev('MOMENTUM_ACCELERATION'), direction: 'down' }, { ...ev('MACD_CROSS'), direction: 'down' }],
      series,
      i,
      context,
    });
    expect(disagree.confidence).toBeLessThan(agree.confidence);
    expect(disagree.contradictingTypes).toEqual(expect.arrayContaining(['MOMENTUM_ACCELERATION', 'MACD_CROSS']));
  });

  it('stores every component it used, each between 0 and 1', () => {
    const score = scoreSignal({ direction: 'up', events: [ev('BREAKOUT')], series, i, context });
    expect(score.components.breakout).toBe(1);
    for (const value of Object.values(score.components)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(score.strength).toBeGreaterThanOrEqual(0);
    expect(score.strength).toBeLessThanOrEqual(100);
  });

  it('only cites numbers it computed', () => {
    const score = scoreSignal({ direction: 'up', events: [ev('PRICE_MOVE')], series, i, context });
    const rsi = score.evidence.find((e) => e.key === 'rsi');
    expect(rsi?.value).toBeCloseTo(series.rsi[i], 1);
    expect(score.evidence.find((e) => e.key === 'market')).toBeUndefined();
  });
});
