'use client';

import { TickerMarquee, type TickerMarqueeItem } from '@/components/ui/ticker-marquee';

export default function TickerTape({ items }: { items: TickerMarqueeItem[] }) {
  return <TickerMarquee items={items} className="mb-7 border-y" durationSec={24} />;
}
