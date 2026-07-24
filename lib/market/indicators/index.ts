import type { Candle } from '../ohlcv';

export function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    const slice = values.slice(i - period + 1, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

export function rsi(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

export function macd(closes: number[], fast = 12, slow = 26, signal = 9) {
  const ema = (data: number[], p: number) => {
    const k = 2 / (p + 1);
    const out: number[] = [];
    data.forEach((val, i) => {
      if (i === 0) out.push(val);
      else out.push(val * k + out[i - 1] * (1 - k));
    });
    return out;
  };

  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
  const signalLine = ema(macdLine, signal);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);

  return { macdLine, signalLine, histogram };
}

export function bollingerBands(closes: number[], period = 20, stdDev = 2) {
  const middle = sma(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i];
    const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper.push(mean + stdDev * sd);
    lower.push(mean - stdDev * sd);
  }

  return { upper, middle, lower };
}

export function computeIndicators(candles: Candle[]) {
  const closes = candles.map((c) => c.close);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const rsi14 = rsi(closes, 14);
  const macdResult = macd(closes);
  const bb = bollingerBands(closes, 20);

  const lastFinite = (arr: number[]) => {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (Number.isFinite(arr[i])) return arr[i];
    }
    return NaN;
  };

  return {
    sma20: lastFinite(sma20),
    sma50: lastFinite(sma50),
    rsi14: lastFinite(rsi14),
    macd: {
      macd: lastFinite(macdResult.macdLine),
      signal: lastFinite(macdResult.signalLine),
      histogram: lastFinite(macdResult.histogram),
    },
    bollinger: {
      upper: lastFinite(bb.upper),
      middle: lastFinite(bb.middle),
      lower: lastFinite(bb.lower),
    },
    series: {
      sma20,
      sma50,
      rsi14,
      macd: macdResult,
      bollinger: bb,
    },
    ...(candles.length ? { barCount: candles.length } : {}),
  };
}

export function deriveSignals(
  indicators: ReturnType<typeof computeIndicators>,
  candles?: Candle[]
) {
  const signals: { label: string; type: 'bullish' | 'bearish' | 'neutral' | 'warning' }[] = [];

  if (Number.isFinite(indicators.sma20) && Number.isFinite(indicators.sma50)) {
    if (indicators.sma20 > indicators.sma50) {
      signals.push({ label: 'Bullish trend', type: 'bullish' });
    } else {
      signals.push({ label: 'Bearish trend', type: 'bearish' });
    }
  }

  // Volatility from Bollinger band width vs recent average
  const bb = indicators.series.bollinger;
  const widths: number[] = [];
  for (let i = 0; i < bb.upper.length; i++) {
    if (Number.isFinite(bb.upper[i]) && Number.isFinite(bb.lower[i]) && bb.middle[i]) {
      widths.push((bb.upper[i] - bb.lower[i]) / bb.middle[i]);
    }
  }
  if (widths.length >= 5) {
    const last = widths[widths.length - 1];
    const avg =
      widths.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, widths.length);
    if (last > avg * 1.35) signals.push({ label: 'Volatility warning', type: 'warning' });
    else if (last < avg * 0.7) signals.push({ label: 'Low volatility', type: 'neutral' });
    else signals.push({ label: 'Volatility normal', type: 'neutral' });
  }

  // Volume vs short SMA
  if (candles && candles.length >= 10) {
    const vols = candles.map((c) => c.volume ?? 0);
    const lastVol = vols[vols.length - 1];
    const lookback = vols.slice(-21, -1).filter((v) => v > 0);
    if (lookback.length >= 5 && lastVol > 0) {
      const avgVol = lookback.reduce((a, b) => a + b, 0) / lookback.length;
      if (lastVol > avgVol * 1.4) signals.push({ label: 'Volume elevated', type: 'bullish' });
      else if (lastVol < avgVol * 0.6) signals.push({ label: 'Volume light', type: 'warning' });
      else signals.push({ label: 'Volume neutral', type: 'neutral' });
    } else {
      signals.push({ label: 'Volume neutral', type: 'neutral' });
    }
  }

  if (Number.isFinite(indicators.rsi14)) {
    if (indicators.rsi14 > 70) signals.push({ label: 'Overbought RSI', type: 'warning' });
    else if (indicators.rsi14 < 30) signals.push({ label: 'Oversold RSI', type: 'bullish' });
  }

  if (indicators.macd.histogram > 0) {
    signals.push({ label: 'Bullish momentum', type: 'bullish' });
  } else if (indicators.macd.histogram < 0) {
    signals.push({ label: 'Bearish momentum', type: 'bearish' });
  }

  return signals;
}
