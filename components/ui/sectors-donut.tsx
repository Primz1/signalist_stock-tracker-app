'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PALETTE, SERIES } from '@/lib/theme';

/** Portfolio allocation donut — sized to fill the card; legend stays tight. */

export interface DonutSector {
  label: string;
  pct: number;
}

const SIGNALIST_COLORS = SERIES;

const DEFAULT_SECTORS: DonutSector[] = [
  { label: 'NVDA', pct: 32 },
  { label: 'AAPL', pct: 19 },
  { label: 'MSFT', pct: 13 },
  { label: 'Cash', pct: 12 },
  { label: 'TSLA', pct: 9 },
];

const SIZE = 200;
const CX = SIZE / 2;
const R = 84;
const STROKE = 16;
const C = 2 * Math.PI * R;
const EASE = [0.16, 1, 0.3, 1] as const;

export function SectorsDonut({
  symbol = 'PAPER',
  caption = 'Total value',
  sectors = DEFAULT_SECTORS,
  colors = SIGNALIST_COLORS,
  className,
}: {
  symbol?: string;
  caption?: string;
  sectors?: DonutSector[];
  colors?: string[];
  className?: string;
  /** @deprecated kept for call-site compat — layout is always compact now */
  legendColumns?: 1 | 2;
}) {
  const reduced = useReducedMotion();
  const [hot, setHot] = useState<number | null>(null);

  let acc = 0;
  const arcs = sectors.map((s, i) => {
    const start = acc;
    acc += s.pct;
    return { ...s, start, color: colors[i % colors.length] };
  });

  const active = hot != null ? arcs[hot] : null;

  return (
    <div
      className={cn(
        'grid w-full items-center gap-6 sm:grid-cols-[minmax(180px,220px)_minmax(0,1fr)] sm:gap-8',
        className
      )}
    >
      {/* Ring — fills its column */}
      <div className="relative mx-auto aspect-square w-full max-w-[220px]">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full -rotate-90">
          <circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            stroke={PALETTE.surface2}
            strokeWidth={STROKE}
          />
          {arcs.map((a, i) => (
            <motion.circle
              key={a.label}
              cx={CX}
              cy={CX}
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={STROKE}
              strokeLinecap="butt"
              strokeDasharray={`${Math.max(0, (a.pct / 100) * C - 2)} ${C}`}
              strokeDashoffset={-((a.start / 100) * C)}
              initial={{ opacity: reduced ? 1 : 0 }}
              animate={{ opacity: hot === null || hot === i ? 1 : 0.2 }}
              transition={
                reduced ? { duration: 0 } : { duration: 0.3, ease: EASE, delay: 0.04 * i }
              }
              onMouseEnter={() => setHot(i)}
              onMouseLeave={() => setHot(null)}
              style={{ cursor: 'default' }}
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-[14%] flex flex-col items-center justify-center text-center">
          {active ? (
            <>
              <span className="mono text-[13px] font-medium text-ink-2">{active.label}</span>
              <span className="figure mt-0.5 text-[28px] leading-none text-ink">
                {Math.round(active.pct)}%
              </span>
            </>
          ) : (
            <>
              <span className="figure text-[19px] leading-none text-ink sm:text-[21px]">
                {symbol}
              </span>
              <span className="mt-1.5 text-[12px] leading-none text-ink-3">{caption}</span>
            </>
          )}
        </div>
      </div>

      {/* Legend — percent sits right next to the ticker, not pushed to the far edge */}
      <div className="flex min-w-0 flex-col justify-center gap-1">
        {arcs.map((a, i) => (
          <button
            key={a.label}
            type="button"
            onMouseEnter={() => setHot(i)}
            onMouseLeave={() => setHot(null)}
            onFocus={() => setHot(i)}
            onBlur={() => setHot(null)}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
              hot === i ? 'bg-surface-2' : 'hover:bg-surface-2/60',
              hot !== null && hot !== i && 'opacity-40'
            )}
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: a.color }}
            />
            <span className="mono text-[14px] font-medium text-ink">{a.label}</span>
            <span className="mono text-[14px] tabular-nums text-ink-2">
              {Math.round(a.pct)}%
            </span>
            {/* thin weight bar fills remaining space — visual proportion, not empty gap */}
            <span className="ml-auto hidden h-1.5 min-w-[48px] max-w-[120px] flex-1 overflow-hidden rounded-full bg-surface-2 sm:block">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.min(100, a.pct)}%`,
                  background: a.color,
                }}
              />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
