import type { SignalDirection, SignalKind } from '@/lib/events/types';

export type SignalSnapshot = {
  price: number;
  ohlcv?: { volume?: number }[];
  indicators?: {
    rsi14?: number;
    macd?: { histogram: number };
    bollinger?: { upper: number; lower: number };
  };
};

export type DetectedSignal = {
  kind: SignalKind;
  direction: SignalDirection;
  label: string;
  detail: string;
};

export const SIGNAL_COOLDOWN_MS = 4 * 60 * 60 * 1000;

const MIN_RETURNS = 8;
const MIN_MOVE_PCT = 0.5;
const MOVE_STDEVS = 2.5;
const VOLUME_MULTIPLE = 2;
const VOLUME_LOOKBACK = 20;

const pctChange = (from: number, to: number) => ((to - from) / from) * 100;

function stdev(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
}

function detectUnusualMove(history: SignalSnapshot[]): DetectedSignal | null {
  const returns = history.slice(1).map((snap, i) => pctChange(history[i].price, snap.price));
  const move = returns[returns.length - 1];
  const prior = returns.slice(0, -1);
  if (prior.length < MIN_RETURNS) return null;

  const threshold = stdev(prior) * MOVE_STDEVS;
  if (Math.abs(move) < Math.max(threshold, MIN_MOVE_PCT)) return null;

  return {
    kind: 'unusual_move',
    direction: move > 0 ? 'up' : 'down',
    label: `Unusual move ${move > 0 ? 'up' : 'down'}`,
    detail: `${move > 0 ? '+' : ''}${move.toFixed(2)}% since the last reading, against a usual range of ±${threshold.toFixed(2)}%`,
  };
}

function detectRsiCross(prev: SignalSnapshot, curr: SignalSnapshot): DetectedSignal | null {
  const before = prev.indicators?.rsi14;
  const after = curr.indicators?.rsi14;
  if (before == null || after == null) return null;

  if (before < 70 && after >= 70) {
    return {
      kind: 'rsi_cross',
      direction: 'up',
      label: 'RSI above 70',
      detail: `RSI rose from ${before.toFixed(1)} to ${after.toFixed(1)}`,
    };
  }
  if (before > 30 && after <= 30) {
    return {
      kind: 'rsi_cross',
      direction: 'down',
      label: 'RSI below 30',
      detail: `RSI fell from ${before.toFixed(1)} to ${after.toFixed(1)}`,
    };
  }
  return null;
}

function detectMacdCross(prev: SignalSnapshot, curr: SignalSnapshot): DetectedSignal | null {
  const before = prev.indicators?.macd?.histogram;
  const after = curr.indicators?.macd?.histogram;
  if (before == null || after == null || before === 0 || after === 0) return null;
  if (Math.sign(before) === Math.sign(after)) return null;

  const up = after > 0;
  return {
    kind: 'macd_cross',
    direction: up ? 'up' : 'down',
    label: `MACD crossed ${up ? 'above' : 'below'} signal`,
    detail: `Histogram moved from ${before.toFixed(3)} to ${after.toFixed(3)}`,
  };
}

function detectBollingerBreak(prev: SignalSnapshot, curr: SignalSnapshot): DetectedSignal | null {
  const band = curr.indicators?.bollinger;
  const prevBand = prev.indicators?.bollinger;
  if (!band || !prevBand) return null;

  if (curr.price > band.upper && prev.price <= prevBand.upper) {
    return {
      kind: 'bollinger_break',
      direction: 'up',
      label: 'Above upper Bollinger band',
      detail: `Price ${curr.price.toFixed(2)} is above the band at ${band.upper.toFixed(2)}`,
    };
  }
  if (curr.price < band.lower && prev.price >= prevBand.lower) {
    return {
      kind: 'bollinger_break',
      direction: 'down',
      label: 'Below lower Bollinger band',
      detail: `Price ${curr.price.toFixed(2)} is below the band at ${band.lower.toFixed(2)}`,
    };
  }
  return null;
}

/** Last candle's volume as a multiple of the average of the candles before it. */
function volumeMultiple(snapshot: SignalSnapshot) {
  const volumes = (snapshot.ohlcv ?? []).map((c) => c.volume ?? 0);
  if (volumes.length < VOLUME_LOOKBACK + 1) return null;
  const last = volumes[volumes.length - 1];
  const prior = volumes.slice(-VOLUME_LOOKBACK - 1, -1);
  const average = prior.reduce((a, b) => a + b, 0) / prior.length;
  return average > 0 ? last / average : null;
}

function detectVolumeSpike(prev: SignalSnapshot, curr: SignalSnapshot): DetectedSignal | null {
  const after = volumeMultiple(curr);
  const before = volumeMultiple(prev);
  if (after == null || after < VOLUME_MULTIPLE || (before != null && before >= VOLUME_MULTIPLE)) return null;

  return {
    kind: 'volume_spike',
    direction: curr.price >= prev.price ? 'up' : 'down',
    label: 'Volume spike',
    detail: `Volume is ${after.toFixed(1)}x the ${VOLUME_LOOKBACK}-candle average`,
  };
}

/** Compares the two newest snapshots. `history` runs oldest to newest. */
export function detectSignals(history: SignalSnapshot[]): DetectedSignal[] {
  if (history.length < 2) return [];
  const curr = history[history.length - 1];
  const prev = history[history.length - 2];

  return [
    detectUnusualMove(history),
    detectRsiCross(prev, curr),
    detectMacdCross(prev, curr),
    detectBollingerBreak(prev, curr),
    detectVolumeSpike(prev, curr),
  ].filter((signal): signal is DetectedSignal => signal !== null);
}

/** Drops signal kinds that already fired for this symbol within the cooldown. */
export function applyCooldown(signals: DetectedSignal[], lastFiredAt: Map<SignalKind, number>, now: number) {
  return signals.filter((signal) => {
    const last = lastFiredAt.get(signal.kind);
    return last == null || now - last >= SIGNAL_COOLDOWN_MS;
  });
}
