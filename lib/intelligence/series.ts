import { atr, bollingerBands, ema, macd, median, rsi, sma } from '@/lib/market/indicators';
import type { Candle } from '@/lib/market/providers/types';
import type { SnapshotAnalytics } from '@/database/models/marketSnapshot.model';
import { minuteOfSession, sessionKey } from './market-hours';

/**
 * Every indicator for every bar, computed once. Each value at index i uses only bars
 * up to i, so live detection and historical replay read the same numbers.
 */
export type BarSeries = {
  symbol: string;
  crypto: boolean;
  bars: Candle[];
  session: string[];
  /** 0 on a session's first bar. Crypto counts from the first bar of each UTC day. */
  barsIntoSession: number[];
  close: number[];
  change1: number[];
  change5: number[];
  change15: number[];
  change60: number[];
  /** Standard deviation of 1-bar returns over the trailing 240 bars: the "usual" move size. */
  returnStd: number[];
  ema20: number[];
  ema50: number[];
  ema200: number[];
  sma20: number[];
  sma50: number[];
  sma200: number[];
  rsi: number[];
  macd: number[];
  macdSignal: number[];
  macdHistogram: number[];
  roc10: number[];
  bollingerUpper: number[];
  bollingerMiddle: number[];
  bollingerLower: number[];
  atr: number[];
  vwap: number[];
  /** Volume of the last 15 bars against the same 15 minutes in earlier sessions. */
  relativeVolume: number[];
  /** Recent 30-bar volatility against its median over the previous 240 bars. */
  volatilityRatio: number[];
  volatility: number[];
  /** Highest high and lowest low of the 60 bars that end 5 bars back. */
  resistance: number[];
  support: number[];
  sessionHigh: number[];
  sessionLow: number[];
};

export type DailyContext = {
  previousClose?: number;
  previousDayHigh?: number;
  previousDayLow?: number;
};

export const SERIES_SETTINGS = {
  volumeWindow: 15,
  volumeSessionsLookback: 5,
  volatilityWindow: 30,
  volatilityBaseline: 240,
  returnStdWindow: 240,
  levelWindow: 60,
  levelGap: 5,
} as const;

const pct = (from: number, to: number) => (from ? ((to - from) / from) * 100 : NaN);

/**
 * Standard deviation over the trailing window, skipping NaN. Each session's first return
 * is NaN on purpose, and one NaN must not blank the next 240 bars.
 */
function rollingStdFinite(values: number[], period: number, minShare = 0.8) {
  return values.map((_, i) => {
    if (i < period - 1) return NaN;
    const slice = values.slice(i - period + 1, i + 1).filter(Number.isFinite);
    if (slice.length < period * minShare) return NaN;
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    return Math.sqrt(slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / slice.length);
  });
}

/** Change over n bars, NaN when it would span two sessions. Overnight gaps are not intraday moves. */
function changeOver(bars: Candle[], session: string[], n: number) {
  return bars.map((bar, i) => (i >= n && session[i - n] === session[i] ? pct(bars[i - n].close, bar.close) : NaN));
}

function sessionVwap(bars: Candle[], session: string[]) {
  const out: number[] = [];
  let pv = 0;
  let vol = 0;
  bars.forEach((bar, i) => {
    if (i === 0 || session[i] !== session[i - 1]) {
      pv = 0;
      vol = 0;
    }
    const v = bar.volume ?? 0;
    pv += ((bar.high + bar.low + bar.close) / 3) * v;
    vol += v;
    out.push(vol > 0 ? pv / vol : NaN);
  });
  return out;
}

function windowSums(volumes: number[], window: number) {
  const sums: number[] = new Array(volumes.length).fill(NaN);
  let running = 0;
  volumes.forEach((v, i) => {
    running += v;
    if (i >= window) running -= volumes[i - window];
    if (i >= window - 1) sums[i] = running;
  });
  return sums;
}

/**
 * Stocks trade far more at the open and close, so a plain rolling average flags every
 * open as a spike. Compare with the same minutes in earlier sessions when we have them,
 * otherwise with the median of earlier windows.
 */
function relativeVolumeSeries(bars: Candle[], session: string[], crypto: boolean) {
  const { volumeWindow: w, volumeSessionsLookback } = SERIES_SETTINGS;
  const volumes = bars.map((b) => b.volume ?? 0);
  const sums = windowSums(volumes, w);
  const minute = bars.map((b) => minuteOfSession(crypto, b.time));
  const bySessionMinute = new Map<string, number>();
  sums.forEach((sum, i) => bySessionMinute.set(`${session[i]}|${minute[i]}`, sum));
  const sessions = Array.from(new Set(session));

  return sums.map((sum, i) => {
    if (!Number.isFinite(sum)) return NaN;
    const current = sessions.indexOf(session[i]);
    const comparable = sessions
      .slice(Math.max(0, current - volumeSessionsLookback), current)
      .map((s) => bySessionMinute.get(`${s}|${minute[i]}`))
      .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);

    let baseline: number;
    if (comparable.length >= 2) {
      baseline = comparable.reduce((a, b) => a + b, 0) / comparable.length;
    } else {
      // Earlier non-overlapping windows, newest first, at most a day's worth
      const prior: number[] = [];
      for (let j = i - w; j >= w - 1 && prior.length < 96; j -= w) if (sums[j] > 0) prior.push(sums[j]);
      if (prior.length < 4) return NaN;
      baseline = median(prior);
    }
    return baseline > 0 ? sum / baseline : NaN;
  });
}

/** Stocks only use the current session, so an overnight gap isn't read as a breakout. */
function rollingExtreme(bars: Candle[], session: string[], crypto: boolean, pick: 'high' | 'low') {
  const { levelWindow, levelGap } = SERIES_SETTINGS;
  return bars.map((_, i) => {
    const end = i - levelGap;
    const start = end - levelWindow;
    if (start < 0) return NaN;
    if (!crypto && session[start] !== session[i]) return NaN;
    const values = bars.slice(start, end).map((b) => b[pick]);
    return pick === 'high' ? Math.max(...values) : Math.min(...values);
  });
}

function sessionExtremes(bars: Candle[], session: string[]) {
  const high: number[] = [];
  const low: number[] = [];
  bars.forEach((bar, i) => {
    const fresh = i === 0 || session[i] !== session[i - 1];
    high.push(fresh ? bar.high : Math.max(high[i - 1], bar.high));
    low.push(fresh ? bar.low : Math.min(low[i - 1], bar.low));
  });
  return { high, low };
}

export function buildSeries(symbol: string, crypto: boolean, bars: Candle[]): BarSeries {
  const session = bars.map((b) => sessionKey(crypto, b.time));
  const close = bars.map((b) => b.close);
  const change1 = changeOver(bars, session, 1);
  const returnStd = rollingStdFinite(change1, SERIES_SETTINGS.returnStdWindow);
  const volatility = rollingStdFinite(change1, SERIES_SETTINGS.volatilityWindow);
  const barsIntoSession: number[] = [];
  session.forEach((key, i) => barsIntoSession.push(i > 0 && session[i - 1] === key ? barsIntoSession[i - 1] + 1 : 0));
  const volatilityRatio = volatility.map((v, i) => {
    const prior = volatility.slice(Math.max(0, i - SERIES_SETTINGS.volatilityBaseline), i);
    if (prior.filter(Number.isFinite).length < SERIES_SETTINGS.volatilityBaseline / 2) return NaN;
    const base = median(prior);
    return base > 0 ? v / base : NaN;
  });
  const m = macd(close);
  const bands = bollingerBands(close, 20);
  const extremes = sessionExtremes(bars, session);

  return {
    symbol,
    crypto,
    bars,
    session,
    barsIntoSession,
    close,
    change1,
    change5: changeOver(bars, session, 5),
    change15: changeOver(bars, session, 15),
    change60: changeOver(bars, session, 60),
    returnStd,
    ema20: ema(close, 20),
    ema50: ema(close, 50),
    ema200: ema(close, 200),
    sma20: sma(close, 20),
    sma50: sma(close, 50),
    sma200: sma(close, 200),
    rsi: rsi(close, 14),
    macd: m.macdLine,
    macdSignal: m.signalLine,
    macdHistogram: m.histogram,
    roc10: changeOver(bars, session, 10),
    bollingerUpper: bands.upper,
    bollingerMiddle: bands.middle,
    bollingerLower: bands.lower,
    atr: atr(bars, 14),
    vwap: sessionVwap(bars, session),
    relativeVolume: relativeVolumeSeries(bars, session, crypto),
    volatilityRatio,
    volatility,
    resistance: rollingExtreme(bars, session, crypto, 'high'),
    support: rollingExtreme(bars, session, crypto, 'low'),
    sessionHigh: extremes.high,
    sessionLow: extremes.low,
  };
}

const finiteOrUndefined = (v: number | undefined) => (v != null && Number.isFinite(v) ? v : undefined);

/** The snapshot stored for bar i. Daily context comes from daily candles. */
export function analyticsAt(series: BarSeries, i: number, daily: DailyContext = {}): SnapshotAnalytics {
  const bar = series.bars[i];
  const f = (arr: number[]) => finiteOrUndefined(arr[i]);
  return {
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    change1m: f(series.change1),
    change5m: f(series.change5),
    change15m: f(series.change15),
    change1h: f(series.change60),
    change1d: daily.previousClose ? finiteOrUndefined(pct(daily.previousClose, bar.close)) : undefined,
    rsi: f(series.rsi),
    macd: f(series.macd),
    macdSignal: f(series.macdSignal),
    macdHistogram: f(series.macdHistogram),
    roc: f(series.roc10),
    ema20: f(series.ema20),
    ema50: f(series.ema50),
    ema200: f(series.ema200),
    sma20: f(series.sma20),
    sma50: f(series.sma50),
    sma200: f(series.sma200),
    vwap: f(series.vwap),
    atr: f(series.atr),
    bollingerUpper: f(series.bollingerUpper),
    bollingerMiddle: f(series.bollingerMiddle),
    bollingerLower: f(series.bollingerLower),
    relativeVolume: f(series.relativeVolume),
    volatility: f(series.volatility),
    sessionHigh: f(series.sessionHigh),
    sessionLow: f(series.sessionLow),
    previousDayHigh: finiteOrUndefined(daily.previousDayHigh),
    previousDayLow: finiteOrUndefined(daily.previousDayLow),
    resistance: f(series.resistance),
    support: f(series.support),
  };
}

/** Previous session's close, high and low from daily candles, relative to bar time. */
export function dailyContextFor(crypto: boolean, daily: Candle[], barTime: number): DailyContext {
  const today = sessionKey(crypto, barTime);
  const prior = daily.filter((d) => sessionKey(crypto, d.time) < today);
  const prev = prior.at(-1);
  return prev ? { previousClose: prev.close, previousDayHigh: prev.high, previousDayLow: prev.low } : {};
}
