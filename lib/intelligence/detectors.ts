import type { BarSeries } from './series';
import type { EventDirection, MarketEventType, Severity } from './types';

/**
 * Turns the analytics series into discrete events. Every detector is edge-triggered:
 * it fires on the bar where its condition becomes true, not on every bar it stays true.
 * Thresholds are documented in docs/SIGNAL_ENGINE.md.
 */

export type DetectedEvent = {
  eventType: MarketEventType;
  direction: EventDirection;
  severity: Severity;
  /** Bar open time, unix seconds. */
  time: number;
  data: Record<string, number | string | boolean | null>;
};

export const DETECTOR_SETTINGS = {
  /** A move must be this many standard deviations of the usual 1-bar move, scaled by √n. */
  moveZ: 3,
  moveZHigh: 5,
  /** And at least this large in percent, so quiet tickers don't fire on cents. */
  minMovePct: { stock: { 1: 0.35, 5: 0.7, 15: 1.2 }, crypto: { 1: 0.5, 5: 1.0, 15: 1.8 } },
  volumeSpike: 2.5,
  volumeSpikeHigh: 4,
  /** Breakouts must close beyond the level by this fraction of ATR, and at least 0.1%. */
  breakoutAtrBuffer: 0.25,
  breakoutMinBufferPct: 0.1,
  breakoutMinVolume: 1.3,
  rsiOverbought: 70,
  rsiOversold: 30,
  /** RSI change over 5 bars that counts as accelerating momentum. */
  rsiAcceleration: 15,
  /** EMA crosses need the gap to open this wide (percent of price), so touches don't count. */
  maCrossMinGapPct: 0.03,
  vwapCrossBufferPct: 0.1,
  volatilityExpansion: 1.8,
  volatilityContraction: 0.5,
  /** Stocks: skip the opening bars while the session's range and indicators settle. */
  openingBarsSkipped: 15,
} as const;

const S = DETECTOR_SETTINGS;
const ok = (...values: number[]) => values.every(Number.isFinite);
const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
const dir = (n: number): EventDirection => (n > 0 ? 'up' : n < 0 ? 'down' : 'neutral');

function priceMove(s: BarSeries, i: number): DetectedEvent | null {
  const std = s.returnStd[i];
  const prevStd = s.returnStd[i - 1];
  if (!ok(std) || std <= 0) return null;
  const floors = S.minMovePct[s.crypto ? 'crypto' : 'stock'];

  // Largest horizon that newly qualifies, so a 15-minute move isn't also reported as 1 and 5
  for (const [n, series] of [[15, s.change15], [5, s.change5], [1, s.change1]] as const) {
    const move = series[i];
    const prevMove = series[i - 1];
    if (!ok(move)) continue;
    const z = Math.abs(move) / (std * Math.sqrt(n));
    const prevZ = ok(prevMove, prevStd) && prevStd > 0 ? Math.abs(prevMove) / (prevStd * Math.sqrt(n)) : 0;
    if (z >= S.moveZ && Math.abs(move) >= floors[n] && prevZ < S.moveZ) {
      return {
        eventType: 'PRICE_MOVE',
        direction: dir(move),
        severity: z >= S.moveZHigh ? 'high' : 'medium',
        time: s.bars[i].time,
        data: { windowMinutes: n, changePct: round(move), zScore: round(z, 1), usualMovePct: round(std * Math.sqrt(n), 3) },
      };
    }
  }
  return null;
}

function volumeSpike(s: BarSeries, i: number): DetectedEvent | null {
  const rv = s.relativeVolume[i];
  const prev = s.relativeVolume[i - 1];
  if (!ok(rv) || rv < S.volumeSpike || (ok(prev) && prev >= S.volumeSpike)) return null;
  const move = s.change15[i];
  return {
    eventType: 'VOLUME_SPIKE',
    direction: ok(move) ? dir(move) : 'neutral',
    severity: rv >= S.volumeSpikeHigh ? 'high' : 'medium',
    time: s.bars[i].time,
    data: { relativeVolume: round(rv, 1), windowMinutes: 15, changePct: ok(move) ? round(move) : null },
  };
}

function levelBreak(s: BarSeries, i: number): DetectedEvent | null {
  const close = s.close[i];
  const prevClose = s.close[i - 1];
  const atrValue = s.atr[i];
  const rv = s.relativeVolume[i];
  if (!ok(close, prevClose, atrValue)) return null;
  const buffer = Math.max((S.breakoutAtrBuffer * atrValue) / close, S.breakoutMinBufferPct / 100);
  const volumeOk = !ok(rv) || rv >= S.breakoutMinVolume;

  const resistance = s.resistance[i];
  if (ok(resistance) && close > resistance * (1 + buffer) && prevClose <= resistance * (1 + buffer) && volumeOk) {
    return {
      eventType: 'BREAKOUT',
      direction: 'up',
      severity: ok(rv) && rv >= S.volumeSpike ? 'high' : 'medium',
      time: s.bars[i].time,
      data: { level: round(resistance, 4), close: round(close, 4), beyondPct: round(pct(resistance, close)), relativeVolume: ok(rv) ? round(rv, 1) : null },
    };
  }
  const support = s.support[i];
  if (ok(support) && close < support * (1 - buffer) && prevClose >= support * (1 - buffer) && volumeOk) {
    return {
      eventType: 'BREAKDOWN',
      direction: 'down',
      severity: ok(rv) && rv >= S.volumeSpike ? 'high' : 'medium',
      time: s.bars[i].time,
      data: { level: round(support, 4), close: round(close, 4), beyondPct: round(pct(support, close)), relativeVolume: ok(rv) ? round(rv, 1) : null },
    };
  }
  return null;
}

function rsiEvents(s: BarSeries, i: number): DetectedEvent[] {
  const now = s.rsi[i];
  const prev = s.rsi[i - 1];
  const fiveAgo = s.rsi[i - 5];
  const events: DetectedEvent[] = [];
  if (!ok(now, prev)) return events;
  const time = s.bars[i].time;

  if (prev < S.rsiOverbought && now >= S.rsiOverbought) {
    events.push({ eventType: 'RSI_EXTREME', direction: 'up', severity: 'low', time, data: { rsiBefore: round(prev, 1), rsi: round(now, 1), threshold: S.rsiOverbought } });
  } else if (prev > S.rsiOversold && now <= S.rsiOversold) {
    events.push({ eventType: 'RSI_EXTREME', direction: 'down', severity: 'low', time, data: { rsiBefore: round(prev, 1), rsi: round(now, 1), threshold: S.rsiOversold } });
  }

  const prevFiveAgo = s.rsi[i - 6];
  if (ok(fiveAgo, prevFiveAgo)) {
    const delta = now - fiveAgo;
    const prevDelta = prev - prevFiveAgo;
    const hist = s.macdHistogram[i];
    const histPrev = s.macdHistogram[i - 3];
    const histAgrees = ok(hist, histPrev) && Math.sign(hist - histPrev) === Math.sign(delta);
    if (Math.abs(delta) >= S.rsiAcceleration && Math.abs(prevDelta) < S.rsiAcceleration && histAgrees) {
      events.push({
        eventType: 'MOMENTUM_ACCELERATION',
        direction: dir(delta),
        severity: Math.abs(delta) >= S.rsiAcceleration * 1.5 ? 'medium' : 'low',
        time,
        data: { rsiBefore: round(fiveAgo, 1), rsi: round(now, 1), rsiChange: round(delta, 1), windowMinutes: 5 },
      });
    }
  }
  return events;
}

function macdCross(s: BarSeries, i: number): DetectedEvent | null {
  const now = s.macdHistogram[i];
  const prev = s.macdHistogram[i - 1];
  const close = s.close[i];
  if (!ok(now, prev, close) || Math.sign(now) === Math.sign(prev) || now === 0) return null;
  // Ignore crossings too small to see on the chart
  if (Math.abs(now) / close < 0.00005) return null;
  return {
    eventType: 'MACD_CROSS',
    direction: dir(now),
    severity: 'low',
    time: s.bars[i].time,
    data: { histogramBefore: round(prev, 4), histogram: round(now, 4), macd: round(s.macd[i], 4) },
  };
}

function emaCross(s: BarSeries, i: number): DetectedEvent | null {
  const gap = (j: number) => (ok(s.ema20[j], s.ema50[j], s.close[j]) ? ((s.ema20[j] - s.ema50[j]) / s.close[j]) * 100 : NaN);
  const now = gap(i);
  if (!ok(now) || Math.abs(now) < S.maCrossMinGapPct) return null;
  // Find the last bar where the gap was wide: a cross only counts if it was on the other side
  for (let j = i - 1; j >= Math.max(0, i - 30); j--) {
    const g = gap(j);
    if (!ok(g)) return null;
    if (Math.abs(g) >= S.maCrossMinGapPct) {
      if (Math.sign(g) === Math.sign(now)) return null;
      // Only on the first bar that clears the gap
      if (Math.abs(gap(i - 1)) >= S.maCrossMinGapPct && Math.sign(gap(i - 1)) === Math.sign(now)) return null;
      return {
        eventType: 'MOVING_AVERAGE_CROSS',
        direction: dir(now),
        severity: 'low',
        time: s.bars[i].time,
        data: { fast: 'EMA20', slow: 'EMA50', ema20: round(s.ema20[i], 4), ema50: round(s.ema50[i], 4), gapPct: round(now, 3) },
      };
    }
  }
  return null;
}

function vwapCross(s: BarSeries, i: number): DetectedEvent | null {
  // Crypto's daily VWAP resets at midnight UTC and means little; only stocks
  if (s.crypto || i < 1 || s.session[i] !== s.session[i - 1]) return null;
  const vwap = s.vwap[i];
  const close = s.close[i];
  const prevClose = s.close[i - 1];
  const prevVwap = s.vwap[i - 1];
  if (!ok(vwap, close, prevClose, prevVwap)) return null;
  const buffer = S.vwapCrossBufferPct / 100;
  const above = close > vwap * (1 + buffer);
  const below = close < vwap * (1 - buffer);
  const wasAbove = prevClose > prevVwap * (1 + buffer);
  const wasBelow = prevClose < prevVwap * (1 - buffer);
  if ((above && !wasAbove && prevClose <= prevVwap) || (below && !wasBelow && prevClose >= prevVwap)) {
    return {
      eventType: 'VWAP_CROSS',
      direction: above ? 'up' : 'down',
      severity: 'low',
      time: s.bars[i].time,
      data: { vwap: round(vwap, 4), close: round(close, 4) },
    };
  }
  return null;
}

function volatilityShift(s: BarSeries, i: number): DetectedEvent | null {
  const ratio = s.volatilityRatio[i];
  const prev = s.volatilityRatio[i - 1];
  if (!ok(ratio, prev)) return null;
  if (ratio >= S.volatilityExpansion && prev < S.volatilityExpansion) {
    return {
      eventType: 'VOLATILITY_EXPANSION',
      direction: 'neutral',
      severity: ratio >= S.volatilityExpansion * 1.5 ? 'medium' : 'low',
      time: s.bars[i].time,
      data: { volatilityRatio: round(ratio, 1), windowMinutes: 30 },
    };
  }
  if (ratio <= S.volatilityContraction && prev > S.volatilityContraction) {
    return {
      eventType: 'VOLATILITY_CONTRACTION',
      direction: 'neutral',
      severity: 'low',
      time: s.bars[i].time,
      data: { volatilityRatio: round(ratio, 2), windowMinutes: 30 },
    };
  }
  return null;
}

const pct = (from: number, to: number) => ((to - from) / from) * 100;

/** Every event that fires on bar i. */
export function detectAt(s: BarSeries, i: number): DetectedEvent[] {
  if (i < 6) return [];
  if (!s.crypto && s.barsIntoSession[i] < S.openingBarsSkipped) return [];
  return [
    priceMove(s, i),
    volumeSpike(s, i),
    levelBreak(s, i),
    ...rsiEvents(s, i),
    macdCross(s, i),
    emaCross(s, i),
    vwapCross(s, i),
    volatilityShift(s, i),
  ].filter((e): e is DetectedEvent => e !== null);
}

/** Minutes during which the same detector can't fire again in the same direction. */
export const EVENT_COOLDOWN_MINUTES: Record<MarketEventType, number> = {
  PRICE_MOVE: 15,
  VOLUME_SPIKE: 30,
  BREAKOUT: 60,
  BREAKDOWN: 60,
  MOMENTUM_ACCELERATION: 30,
  MOMENTUM_REVERSAL: 30,
  VOLATILITY_EXPANSION: 60,
  VOLATILITY_CONTRACTION: 120,
  RSI_EXTREME: 60,
  MACD_CROSS: 30,
  MOVING_AVERAGE_CROSS: 60,
  VWAP_CROSS: 30,
  NEWS_EVENT: 0,
  EARNINGS_EVENT: 0,
  MARKET_OPEN: 0,
  MARKET_CLOSE: 0,
  SIGNAL_CREATED: 0,
  ALERT_TRIGGERED: 0,
};

/** Stable key: rerunning detection over the same bars produces the same keys, so the database drops repeats. */
export function eventDedupeKey(symbol: string, event: DetectedEvent) {
  return `${symbol}:${event.eventType}:${event.direction}:${event.time}`;
}

/** Drops events still inside their cooldown. `lastFired` maps `type:direction` to unix seconds. */
export function applyEventCooldown(events: DetectedEvent[], lastFired: Map<string, number>) {
  const kept: DetectedEvent[] = [];
  for (const event of events) {
    const key = `${event.eventType}:${event.direction}`;
    const last = lastFired.get(key);
    if (last != null && event.time - last < EVENT_COOLDOWN_MINUTES[event.eventType] * 60) continue;
    lastFired.set(key, event.time);
    kept.push(event);
  }
  return kept;
}
