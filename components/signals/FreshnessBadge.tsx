'use client';

import { freshnessOf, type Freshness } from '@/lib/intelligence/labels';
import { cn } from '@/lib/utils';
import { age } from './format';

const STYLES: Record<Freshness, { dot: string; label: (ago: string) => string }> = {
  live: { dot: 'animate-pulse-soft bg-up', label: () => 'Live' },
  recent: { dot: 'bg-up/60', label: (ago) => `Updated ${ago}` },
  delayed: { dot: 'bg-ink-3', label: (ago) => `Delayed · ${ago}` },
  stale: { dot: 'bg-down', label: (ago) => `Stale · ${ago}` },
  unavailable: { dot: 'bg-ink-3', label: () => 'Unavailable' },
};

/**
 * How current a figure is. A closed market is labelled as closed rather than stale,
 * because an unchanged after-hours price is correct, not broken.
 */
export function FreshnessBadge({
  updatedAt,
  now,
  closed = false,
  className,
}: {
  updatedAt: string | null | undefined;
  now: number | null;
  closed?: boolean;
  className?: string;
}) {
  if (now === null) return <span className={cn('meta', className)} aria-hidden>&nbsp;</span>;
  const state = freshnessOf(updatedAt, now);
  const { dot, label } = STYLES[state];
  const text = closed && state !== 'unavailable' ? `Market closed · ${age(updatedAt!, now)}` : label(updatedAt ? age(updatedAt, now) : '');
  return (
    <span className={cn('meta inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      <span className={cn('size-1.5 rounded-full', closed ? 'bg-ink-3' : dot)} aria-hidden />
      {text}
    </span>
  );
}
