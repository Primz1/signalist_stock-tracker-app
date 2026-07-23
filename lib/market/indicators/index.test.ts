import { describe, it, expect } from 'vitest';
import { sma, rsi, bollingerBands } from './index';

describe('technical indicators', () => {
  const closes = [10, 11, 12, 11, 13, 14, 13, 15, 16, 15, 17, 18, 17, 19, 20];

  it('computes SMA', () => {
    const result = sma(closes, 5);
    expect(result[4]).toBeCloseTo(11.4);
  });

  it('computes RSI in range', () => {
    const result = rsi(closes, 5);
    const last = result[result.length - 1];
    expect(last).toBeGreaterThan(0);
    expect(last).toBeLessThanOrEqual(100);
  });

  it('computes Bollinger bands', () => {
    const { upper, lower, middle } = bollingerBands(closes, 5);
    const i = closes.length - 1;
    expect(upper[i]).toBeGreaterThan(middle[i]);
    expect(lower[i]).toBeLessThan(middle[i]);
  });
});
