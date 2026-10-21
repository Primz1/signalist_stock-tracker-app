'use client';

import { cn } from '@/lib/utils';

type Signal = { label: string; type: 'bullish' | 'bearish' | 'neutral' | 'warning' };

const badgeStyles: Record<Signal['type'], string> = {
  bullish: 'bg-up/12 text-up',
  bearish: 'bg-down/12 text-down',
  neutral: 'bg-ink-2/12 text-ink-2',
  warning: 'bg-signal/12 text-signal',
};

export default function SignalBadges({ signals }: { signals: Signal[] }) {
  if (!signals?.length) return null;

  // Prefer the prototype-style trio first when present
  const preferred = ['Bullish trend', 'Bearish trend', 'Volatility warning', 'Volatility normal', 'Low volatility', 'Volume neutral', 'Volume elevated', 'Volume light'];
  const ordered = [
    ...signals.filter((s) => preferred.includes(s.label)),
    ...signals.filter((s) => !preferred.includes(s.label)),
  ].slice(0, 5);

  return (
    <div className="flex flex-wrap gap-2">
      {ordered.map((s) => (
        <span
          key={s.label}
          className={cn('rounded-md px-2.5 py-1 text-xs font-medium', badgeStyles[s.type])}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}

/** @deprecated use IndicatorPanel inside StockChartSection — kept for any legacy imports */
export function IndicatorPanel({
  indicators,
}: {
  indicators: {
    sma20: number;
    sma50: number;
    rsi14: number;
    macd: { macd: number; signal: number; histogram: number };
    bollinger: { upper: number; middle: number; lower: number };
  } | null;
}) {
  if (!indicators) return null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {[
        { label: 'RSI', value: indicators.rsi14.toFixed(1) },
        { label: 'SMA20', value: `$${indicators.sma20.toFixed(2)}` },
        { label: 'SMA50', value: `$${indicators.sma50.toFixed(2)}` },
        {
          label: 'MACD',
          value: `${indicators.macd.histogram >= 0 ? '+' : ''}${indicators.macd.histogram.toFixed(2)}`,
        },
        {
          label: 'Bollinger',
          value: `${indicators.bollinger.lower.toFixed(0)}–${indicators.bollinger.upper.toFixed(0)}`,
        },
      ].map((r) => (
        <div
          key={r.label}
          className="rounded-lg border border-line bg-surface px-3.5 py-3"
        >
          <div className="mb-1.5 text-[12px] text-ink-3">
            {r.label}
          </div>
          <div className="mono text-base text-ink">{r.value}</div>
        </div>
      ))}
    </div>
  );
}
