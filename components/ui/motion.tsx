'use client';

import { cn } from '@/lib/utils';

/** Route / inline skeleton with Claude Design pulse + shimmer */
export function ShimmerBlock({ className }: { className?: string }) {
  return <div className={cn('skeleton-shimmer rounded-md', className)} />;
}

export function PageEnter({
  children,
  className,
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  return (
    <div className={cn('animate-el', className)} style={{ animationDelay: `${delayMs}ms` }}>
      {children}
    </div>
  );
}
