'use client';

import { TickerMarquee, type TickerMarqueeItem } from '@/components/ui/ticker-marquee';

export default function TickerTape({ items }: { items: TickerMarqueeItem[] }) {
  return <TickerMarquee items={items} className="-mt-6 mb-8 border-b md:-mt-8" durationSec={45} />;
}
