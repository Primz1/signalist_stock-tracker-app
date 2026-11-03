import type { Candle } from '@/lib/market/providers/types';

/** Seeded generators for replay tests. Test-only: nothing in the app imports this. */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normal(rand: () => number) {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Regular-session opens at 13:30 UTC, which is 09:30 New York before the November clock change. */
export const SESSION_OPENS = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'].map(
  (day) => Date.parse(`${day}T13:30:00Z`) / 1000
);
export const BARS_PER_SESSION = 390;

/** Stocks trade most at the open and close. */
export function intradayVolume(minute: number, rand: () => number, base = 10_000) {
  const shape = 1 + 2 * Math.exp(-minute / 30) + 1.5 * Math.exp(-(BARS_PER_SESSION - 1 - minute) / 30);
  return Math.round(base * shape * Math.exp(0.25 * normal(rand)));
}

type PathFn = (args: { session: number; minute: number; price: number; rand: () => number }) => {
  price: number;
  volumeMultiplier?: number;
};

/** Builds stock bars session by session. The path function returns each bar's close. */
export function stockBars(sessions: number, path: PathFn, seed = 7, start = 100): Candle[] {
  const rand = mulberry32(seed);
  const bars: Candle[] = [];
  let price = start;
  for (let s = 0; s < sessions; s++) {
    for (let m = 0; m < BARS_PER_SESSION; m++) {
      const open = price;
      const step = path({ session: s, minute: m, price, rand });
      price = step.price;
      const wiggle = Math.abs(normal(rand)) * 0.0004 * price;
      bars.push({
        time: SESSION_OPENS[s] + m * 60,
        open,
        high: Math.max(open, price) + wiggle,
        low: Math.min(open, price) - wiggle,
        close: price,
        volume: Math.round(intradayVolume(m, rand) * (step.volumeMultiplier ?? 1)),
      });
    }
  }
  return bars;
}

export const randomWalk =
  (vol = 0.0008): PathFn =>
  ({ price, rand }) => ({ price: price * (1 + vol * normal(rand)) });

/** Tight mean-reverting range around `center`. */
export const range =
  (center: number, width = 0.002): PathFn =>
  ({ price, rand }) => ({ price: center + 0.85 * (price - center) + center * width * 0.25 * normal(rand) });

/** 24/7 crypto bars, one per minute, starting at a UTC midnight. */
export function cryptoBars(count: number, path: (i: number, price: number, rand: () => number) => { price: number; volumeMultiplier?: number }, seed = 11, start = 70_000): Candle[] {
  const rand = mulberry32(seed);
  const t0 = Date.parse('2026-10-26T00:00:00Z') / 1000;
  const bars: Candle[] = [];
  let price = start;
  for (let i = 0; i < count; i++) {
    const open = price;
    const step = path(i, price, rand);
    price = step.price;
    const wiggle = Math.abs(normal(rand)) * 0.0003 * price;
    bars.push({
      time: t0 + i * 60,
      open,
      high: Math.max(open, price) + wiggle,
      low: Math.min(open, price) - wiggle,
      close: price,
      volume: Math.round(20 * Math.exp(0.3 * normal(rand)) * (step.volumeMultiplier ?? 1)),
    });
  }
  return bars;
}
