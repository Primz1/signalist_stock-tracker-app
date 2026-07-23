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

  const last = closes.length - 1;
  return {
    sma20: sma20[last],
    sma50: sma50[last],
    rsi14: rsi14[last],
    macd: {
      macd: macdResult.macdLine[last],
      signal: macdResult.signalLine[last],
      histogram: macdResult.histogram[last],
    },
    bollinger: {
      upper: bb.upper[last],
      middle: bb.middle[last],
      lower: bb.lower[last],
    },
    series: {
      sma20,
      sma50,
      rsi14,
      macd: macdResult,
      bollinger: bb,
    },
  };
}

export function deriveSignals(indicators: ReturnType<typeof computeIndicators>) {
  const signals: { label: string; type: 'bullish' | 'bearish' | 'neutral' | 'warning' }[] = [];

  if (indicators.rsi14 > 70) signals.push({ label: 'Overbought RSI', type: 'warning' });
  else if (indicators.rsi14 < 30) signals.push({ label: 'Oversold RSI', type: 'bullish' });
  else signals.push({ label: 'Neutral RSI', type: 'neutral' });

  if (indicators.macd.histogram > 0) signals.push({ label: 'Bullish momentum', type: 'bullish' });
  else signals.push({ label: 'Bearish momentum', type: 'bearish' });

  if (indicators.sma20 > indicators.sma50) signals.push({ label: 'Uptrend (MA20 > MA50)', type: 'bullish' });
  else signals.push({ label: 'Downtrend (MA20 < MA50)', type: 'bearish' });

  return signals;
}
