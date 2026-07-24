'use client';

import { cn } from '@/lib/utils';

export type TickerMarqueeItem = {
  symbol: string;
  price: string;
  change: string;
  up: boolean;
};

/**
 * Finance ticker marquee adapted from P1 PerspectiveMarquee:
 * continuous loop + edge fades. Kept at ticker scale (no Remotion / 3D / huge type).
 */
export function TickerMarquee({
  items,
  className,
  durationSec = 22,
}: {
  items: TickerMarqueeItem[];
  className?: string;
  durationSec?: number;
}) {
  if (!items.length) return null;
  const loop = [...items, ...items];

  return (
    <div
      className={cn(
        'relative h-9 w-full overflow-hidden border-b border-[#242424] bg-[#0A0A0A]',
        className
      )}
    >
      <div
        className="flex h-full w-max items-center gap-8 whitespace-nowrap px-4 will-change-transform"
        style={{ animation: `marquee ${durationSec}s linear infinite` }}
      >
        {loop.map((t, i) => (
          <div
            key={`${t.symbol}-${i}`}
            className="mono flex flex-none items-center gap-1.5 text-xs"
          >
            <span className="text-[#A1A1A1]">{t.symbol}</span>
            <span className="text-[#F5F5F5]">{t.price}</span>
            <span className={t.up ? 'text-[#22C55E]' : 'text-[#EF4444]'}>{t.change}</span>
          </div>
        ))}
      </div>
      {/* P1 edge fade — horizontal only; vertical fade omitted to keep ticker density */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, #0A0A0A 0%, transparent 12%, transparent 88%, #0A0A0A 100%)',
        }}
      />
    </div>
  );
}
