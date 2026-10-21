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
        'relative h-9 w-full overflow-hidden border-b border-line bg-canvas',
        className
      )}
      style={{
        maskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)',
      }}
    >
      <div
        className="animate-marquee flex h-full w-max items-center gap-8 whitespace-nowrap px-4 will-change-transform hover:[animation-play-state:paused]"
        style={{ animationDuration: `${durationSec}s` }}
      >
        {loop.map((t, i) => (
          <div
            key={`${t.symbol}-${i}`}
            className="mono flex flex-none items-center gap-2 text-[12px]"
          >
            <span className="text-ink-2">{t.symbol}</span>
            <span className="text-ink">{t.price}</span>
            <span className={t.up ? 'text-up' : 'text-down'}>{t.change}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
