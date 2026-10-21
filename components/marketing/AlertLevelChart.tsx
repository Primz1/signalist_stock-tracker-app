'use client';

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import type { Candle } from '@/lib/market/ohlcv';
import { cn } from '@/lib/utils';

const W = 1200;
const H = 440;
const PAD_Y = 24;

function niceStep(price: number) {
  if (price >= 1000) return 50;
  if (price >= 200) return 5;
  if (price >= 50) return 1;
  if (price >= 10) return 0.5;
  return 0.05;
}

function fmt(n: number, step: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: step < 1 ? 2 : 0,
    maximumFractionDigits: step < 1 ? 2 : 0,
  });
}

/** Price touched the level when the candle's range contains it; count each new touch once. */
function crossings(candles: Candle[], level: number) {
  let count = 0;
  let last: number | null = null;
  let prev = false;
  for (const c of candles) {
    const touched = c.low <= level && level <= c.high;
    if (touched && !prev) count++;
    if (touched) last = c.time;
    prev = touched;
  }
  return { count, last };
}

/**
 * The landing hero's live thing: real daily candles drawn as grey noise; the sessions
 * where price touched your level light up amber. Drag the level (or use arrow keys).
 * Renders a complete, correct picture on the server; dragging is the enhancement.
 */
export function AlertLevelChart({
  symbol,
  candles,
  className,
}: {
  symbol: string;
  candles: Candle[];
  className?: string;
}) {
  const id = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const { lo, hi, step, initial, lastClose } = useMemo(() => {
    const lows = candles.map((c) => c.low);
    const highs = candles.map((c) => c.high);
    const lo = Math.min(...lows);
    const hi = Math.max(...highs);
    const closes = candles.slice(-60).map((c) => c.close).sort((a, b) => a - b);
    const median = closes[Math.floor(closes.length / 2)] ?? (lo + hi) / 2;
    const step = niceStep(median);
    return {
      lo,
      hi,
      step,
      initial: Math.round(median / step) * step,
      lastClose: candles[candles.length - 1]?.close ?? median,
    };
  }, [candles]);

  const [level, setLevel] = useState(initial);
  const clamp = useCallback(
    (v: number) => Math.min(hi, Math.max(lo, Math.round(v / step) * step)),
    [hi, lo, step]
  );

  const y = useCallback(
    (price: number) => PAD_Y + ((hi - price) / (hi - lo || 1)) * (H - PAD_Y * 2),
    [hi, lo]
  );
  const levelPct = (y(level) / H) * 100;

  const { count, last } = useMemo(() => crossings(candles, level), [candles, level]);
  const distance = ((lastClose - level) / level) * 100;

  const setFromPointer = (clientY: number) => {
    const el = plotRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const frac = (clientY - r.top) / r.height;
    const svgY = frac * H;
    const price = hi - ((svgY - PAD_Y) / (H - PAD_Y * 2)) * (hi - lo);
    setLevel(clamp(price));
  };

  const onKey = (e: React.KeyboardEvent) => {
    const big = step * 10;
    const map: Record<string, number> = {
      ArrowUp: step,
      ArrowRight: step,
      ArrowDown: -step,
      ArrowLeft: -step,
      PageUp: big,
      PageDown: -big,
    };
    if (e.key in map) {
      e.preventDefault();
      setLevel((l) => clamp(l + map[e.key]));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setLevel(clamp(lo));
    } else if (e.key === 'End') {
      e.preventDefault();
      setLevel(clamp(hi));
    }
  };

  const n = candles.length;
  const slot = W / n;
  const body = Math.max(1.5, slot * 0.62);
  const sessions = n;
  const lastLabel = last
    ? new Date(last * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;
  const levelLabel = fmt(level, step);

  return (
    <figure className={cn('@container w-full', className)}>
      <figcaption className="flex flex-col gap-4 @3xl:flex-row @3xl:items-end @3xl:justify-between">
        <div>
          <div className="text-[15px] text-ink-2">
            <span className="mono font-medium text-ink">{symbol}</span> · daily candles, last{' '}
            {sessions} sessions
          </div>
          <div className="mt-1 text-[14px] text-ink-3">
            Drag the amber level. Sessions that touched it light up.
          </div>
        </div>
        <div aria-live="polite" className="@3xl:text-right">
          <div className="mono text-[40px] font-medium leading-none tracking-[-0.03em] text-ink md:text-[48px]">
            {count}
            <span className="ml-2 font-sans text-[16px] font-normal tracking-normal text-ink-2">
              {count === 1 ? 'time price reached it' : 'times price reached it'}
            </span>
          </div>
          <div className="mono mt-2 text-[13px] text-ink-3">
            at {levelLabel}
            {lastLabel ? ` · last on ${lastLabel}` : ''} · now{' '}
            {Math.abs(distance).toFixed(1)}% {distance >= 0 ? 'above' : 'below'}
          </div>
        </div>
      </figcaption>

      <div
        ref={plotRef}
        className={cn(
          'relative mt-6 h-[300px] touch-none select-none md:h-[440px]',
          dragging ? 'cursor-grabbing' : 'cursor-ns-resize'
        )}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setDragging(true);
          setFromPointer(e.clientY);
        }}
        onPointerMove={(e) => dragging && setFromPointer(e.clientY)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-y-0 left-0 h-full w-[calc(100%-5.5rem)]"
          role="img"
          aria-label={`${symbol} daily price, ${sessions} sessions, ranging from ${fmt(lo, step)} to ${fmt(hi, step)}`}
        >
          {candles.map((c, i) => {
            const x = i * slot + slot / 2;
            const touched = c.low <= level && level <= c.high;
            const up = c.close >= c.open;
            const color = touched ? 'var(--sg-signal)' : up ? 'var(--sg-ink-3)' : 'var(--sg-line-strong)';
            const top = y(Math.max(c.open, c.close));
            const bottom = y(Math.min(c.open, c.close));
            return (
              <g key={c.time}>
                <line
                  x1={x}
                  x2={x}
                  y1={y(c.high)}
                  y2={y(c.low)}
                  stroke={color}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <rect
                  x={x - body / 2}
                  y={top}
                  width={body}
                  height={Math.max(1, bottom - top)}
                  fill={color}
                />
              </g>
            );
          })}
          <line
            x1={0}
            x2={W}
            y1={y(level)}
            y2={y(level)}
            stroke="var(--sg-signal)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div
          aria-hidden
          className="pointer-events-none absolute right-0 h-px w-[5.5rem] bg-signal"
          style={{ top: `${levelPct}%` }}
        />
        <div
          role="slider"
          tabIndex={0}
          aria-labelledby={`${id}-label`}
          aria-valuemin={lo}
          aria-valuemax={hi}
          aria-valuenow={level}
          aria-valuetext={`${levelLabel}, ${count} crossings`}
          onKeyDown={onKey}
          className={cn(
            'mono absolute right-0 flex h-8 -translate-y-1/2 items-center gap-1.5 rounded-md bg-signal px-2.5 text-[13px] font-semibold text-signal-ink outline-offset-4',
            dragging ? 'scale-[1.04]' : 'transition-[top] duration-150 ease-[var(--ease-out-ui)]'
          )}
          style={{ top: `${levelPct}%` }}
        >
          <span id={`${id}-label`} className="sr-only">
            Alert level for {symbol}
          </span>
          <svg viewBox="0 0 10 14" className="h-3 w-2.5" aria-hidden>
            <path d="M5 0 9 4H1zM5 14 1 10h8z" fill="currentColor" />
          </svg>
          {levelLabel}
        </div>
      </div>
    </figure>
  );
}
