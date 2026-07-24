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
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-[#6E6E6E]">
        <span>{label}</span>
        <span className="mono text-[#F5F5F5]">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#1C1C1C]">
        <div
          className="h-full rounded-full bg-[#FDD458] transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
