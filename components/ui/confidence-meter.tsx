'use client';

import { cn } from '@/lib/utils';

/** Compact confidence / AI score meter (21st confidence meter adapted to Signalist amber). */
export function ConfidenceMeter({
  value,
  label = 'Confidence',
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-[12px] text-ink-3">
        <span>{label}</span>
        <span className="mono text-ink">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-signal transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
