'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { LucideIcon } from 'lucide-react';
import { History, Inbox } from 'lucide-react';

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
  variant?: 'default' | 'dashed';
};

/** Empty state that teaches the next step: what's missing, why, and one action. */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  actionLabel,
  actionHref,
  onAction,
  className,
  variant = 'dashed',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-4 px-6 py-10 sm:flex-row sm:items-center sm:gap-5',
        variant === 'dashed' && 'rounded-lg border border-dashed border-line-strong',
        className
      )}
    >
      <div className="flex size-11 flex-none items-center justify-center rounded-lg bg-surface-2 text-signal">
        <Icon className="size-5" strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        <p className="mt-1 max-w-[52ch] text-[14px] leading-6 text-ink-2">{description}</p>
      </div>
      {(actionLabel && actionHref) || (actionLabel && onAction) ? (
        <div className="flex-none">
          {actionHref ? (
            <Button asChild size="sm">
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function HistoryEmptyState() {
  return (
    <EmptyState
      icon={History}
      title="No trades in this range"
      description="Widen the filter or head to Portfolio to make a paper trade."
      actionLabel="Back to portfolio"
      actionHref="/portfolio"
    />
  );
}
