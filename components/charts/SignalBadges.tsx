'use client';

type Signal = { label: string; type: 'bullish' | 'bearish' | 'neutral' | 'warning' };

const badgeStyles: Record<Signal['type'], string> = {
  bullish: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  bearish: 'bg-red-500/10 text-red-300 border-red-500/30',
  neutral: 'bg-gray-500/10 text-gray-300 border-gray-500/30',
  warning: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
};

export default function SignalBadges({ signals }: { signals: Signal[] }) {
  if (!signals?.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {signals.map((s) => (
        <span
          key={s.label}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${badgeStyles[s.type]}`}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}

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
    <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#242424] bg-[#141414] p-4 text-sm md:grid-cols-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-[#6E6E6E]">RSI (14)</p>
        <p className="mono font-medium text-[#F5F5F5]">{indicators.rsi14.toFixed(1)}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-[#6E6E6E]">SMA 20</p>
        <p className="mono font-medium text-[#22C55E]">${indicators.sma20.toFixed(2)}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-[#6E6E6E]">SMA 50</p>
        <p className="mono font-medium text-[#22C55E]">${indicators.sma50.toFixed(2)}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-[#6E6E6E]">MACD</p>
        <p className="mono font-medium text-[#F5F5F5]">{indicators.macd.histogram >= 0 ? '+' : ''}{indicators.macd.histogram.toFixed(2)}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-[#6E6E6E]">Bollinger</p>
        <p className="mono font-medium text-[#F5F5F5]">
          ${indicators.bollinger.lower.toFixed(0)}–${indicators.bollinger.upper.toFixed(0)}
        </p>
      </div>
    </div>
  );
}
