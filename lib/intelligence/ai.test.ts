import { describe, expect, it } from 'vitest';
import { buildEvidence, deterministicExplanation, type EvidenceInput } from './evidence';
import { normalizeNews } from './news';
import { validateExplanation } from './validate';

const startedAt = new Date('2026-11-03T18:39:00Z');

const input: EvidenceInput = {
  signal: {
    symbol: 'NVDA',
    assetType: 'stock',
    type: 'MOMENTUM_BREAKOUT',
    direction: 'strong_bullish',
    status: 'ACTIVE',
    strength: 84,
    confidence: 88,
    context: 'asset-specific',
    keyLevel: 214.2,
    evidence: [
      { key: 'price', label: 'Price, last 45 min', value: 4.2, unit: 'pct', stance: 'supports' },
      { key: 'relativeVolume', label: 'Relative volume', value: 2.31, unit: 'x', stance: 'supports' },
      { key: 'rsi', label: 'RSI (14)', value: 71, unit: 'index', stance: 'supports' },
      { key: 'market', label: 'SPY', value: 0.4, unit: 'pct', stance: 'context' },
      { key: 'sector', label: 'SMH', value: 1.1, unit: 'pct', stance: 'context' },
    ],
    startedAt,
    updatedAt: new Date('2026-11-03T19:24:00Z'),
    provenance: { priceSource: 'YAHOO', sourceTimestamp: '2026-11-03T19:23:00.000Z', calculatedAt: '2026-11-03T19:24:05.000Z' },
  },
  before: { price: 207.18, rsi: 54 },
  latest: { price: 215.88, rsi: 71.2, vwap: 211.43, relativeVolume: 2.31 },
  events: [
    { timestamp: new Date('2026-11-03T18:41:00Z'), eventType: 'VOLUME_SPIKE', direction: 'up', data: { relativeVolume: 2.6 } },
    { timestamp: new Date('2026-11-03T18:39:00Z'), eventType: 'BREAKOUT', direction: 'up', data: { level: 214.2, close: 214.61 } },
  ],
  news: [
    normalizeNews(
      { headline: 'NVIDIA announces new data center partnership', source: 'Reuters', url: 'https://example.com/a', datetime: Date.parse('2026-11-03T18:32:00Z') / 1000 },
      ['NVDA']
    )!,
  ],
};

describe('evidence builder', () => {
  const evidence = buildEvidence(input);

  it('carries only computed numbers, in the spec shape', () => {
    expect(evidence.price).toEqual({ start: 207.18, current: 215.88, changePct: 4.2 });
    expect(evidence.volume.relative).toBe(2.3);
    expect(evidence.indicators).toEqual({ rsiBefore: 54, rsiNow: 71.2, vwap: 211.43 });
    expect(evidence.levels).toEqual({ keyLevel: 214.2, kind: 'resistance' });
    expect(evidence.market).toEqual({ benchmark: 'SPY', benchmarkChangePct: 0.4, sector: 'SMH', sectorChangePct: 1.1 });
    expect(evidence.signal).toMatchObject({ strength: 84, confidence: 88, title: 'Bullish momentum breakout' });
  });

  it('orders events and times news relative to the move', () => {
    expect(evidence.events.map((e) => e.type)).toEqual(['BREAKOUT', 'VOLUME_SPIKE']);
    expect(evidence.events[1].minutesFromStart).toBe(2);
    expect(evidence.news[0].minutesBeforeStart).toBe(7);
  });

  it('writes deterministic copy that passes its own validator and gives no advice', () => {
    const copy = deterministicExplanation(evidence);
    const text = `${copy.whatChanged} ${copy.context} ${copy.watchNext}`;
    expect(validateExplanation(text, evidence)).toEqual({ ok: true, uncited: [], advice: [] });
    expect(copy.whatChanged).toContain('+4.20%');
    expect(copy.context).toContain('7 minutes before');
    expect(copy.context).toContain('not proof of cause');
    expect(copy.watchNext).toContain('$214.20');
  });
});

describe('numeric validator', () => {
  const evidence = buildEvidence(input);
  const check = (text: string) => validateExplanation(text, evidence);

  it('accepts numbers from the evidence, rounded to the precision written', () => {
    expect(check('NVDA rose 4.2% as relative volume reached 2.3x and RSI moved from 54 to 71.').ok).toBe(true);
    expect(check('Price crossed $214.20 resistance; SPY gained 0.4% and SMH 1.1%.').ok).toBe(true);
    expect(check('NVDA is up about 4%.').ok).toBe(true);
  });

  it('rejects a number the evidence does not contain', () => {
    const result = check('NVDA is now 6.8% above where it started and could reach $230.');
    expect(result.ok).toBe(false);
    expect(result.uncited).toEqual(expect.arrayContaining(['6.8', '$230']));
  });

  it('rejects clock times, which are easy to get wrong across time zones', () => {
    expect(check('The breakout happened at 14:39.').uncited).toContain('14:39');
  });

  it("doesn't let timestamps or links smuggle digits in", () => {
    expect(check('RSI reached 19.').ok).toBe(false);
  });

  it('rejects investment advice', () => {
    expect(check('Investors should buy NVDA here.').advice.length).toBeGreaterThan(0);
    expect(check('You should consider taking profits.').ok).toBe(false);
    expect(check('A good entry; set a stop-loss under the level.').ok).toBe(false);
    expect(check('This is a guaranteed opportunity.').ok).toBe(false);
  });

  it('allows describing a sell-off', () => {
    expect(check('The sell-off eased as RSI recovered to 54.').ok).toBe(true);
  });

  it('treats small structural numbers as prose', () => {
    expect(check('Two of the 3 signals agree.').ok).toBe(true);
    expect(check('Momentum rose 3%.').ok).toBe(false);
  });
});

describe('news normalization', () => {
  it('drops items without a web link or time', () => {
    expect(normalizeNews({ headline: 'x', url: 'javascript:alert(1)', datetime: 1 }, ['NVDA'])).toBeNull();
    expect(normalizeNews({ headline: 'x', url: 'https://a.com' }, ['NVDA'])).toBeNull();
    expect(normalizeNews({ headline: '  ', url: 'https://a.com', datetime: 1 }, ['NVDA'])).toBeNull();
  });

  it('gives the same story the same id', () => {
    const a = normalizeNews({ headline: 'A', url: 'https://a.com/1', datetime: 1 }, ['NVDA']);
    const b = normalizeNews({ headline: 'A updated', url: 'https://a.com/1', datetime: 2 }, ['AMD']);
    expect(a?.newsId).toBe(b?.newsId);
  });
});
