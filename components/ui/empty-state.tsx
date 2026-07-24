'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { LucideIcon } from 'lucide-react';
import { History, Inbox, KeyRound, Star } from 'lucide-react';

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

/** Signalist-themed empty state adapted from 21st Interactive Empty State (CSS motion, no demo CRM chrome). */
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
        'group relative flex flex-col items-center justify-center gap-3 overflow-hidden px-6 py-14 text-center',
        variant === 'dashed' && 'rounded-xl border border-dashed border-[#2E2E2E]',
        className
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, #fff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div className="relative flex isolate justify-center">
        <div className="absolute left-1 top-1 z-10 flex size-11 -translate-x-3 rotate-[-6deg] items-center justify-center rounded-xl border border-[#2E2E2E] bg-[#1C1C1C] text-[#6E6E6E] transition-transform duration-200 group-hover:-translate-x-5 group-hover:-translate-y-1 group-hover:rotate-[-12deg]">
          <Star className="size-4" strokeWidth={1.5} />
        </div>
        <div className="z-20 flex size-12 items-center justify-center rounded-xl border border-[#2E2E2E] bg-[#141414] text-[#FDD458] shadow-lg transition-transform duration-200 group-hover:-translate-y-2 group-hover:scale-110">
          <Icon className="size-5" strokeWidth={1.5} />
        </div>
        <div className="absolute right-1 top-1 z-10 flex size-11 translate-x-3 rotate-[6deg] items-center justify-center rounded-xl border border-[#2E2E2E] bg-[#1C1C1C] text-[#6E6E6E] transition-transform duration-200 group-hover:translate-x-5 group-hover:-translate-y-1 group-hover:rotate-[12deg]">
          <KeyRound className="size-4" strokeWidth={1.5} />
        </div>
      </div>
      <div className="relative mt-4 space-y-1.5">
        <h3 className="text-[15px] font-semibold text-[#F5F5F5]">{title}</h3>
        <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-[#6E6E6E]">{description}</p>
      </div>
      {(actionLabel && actionHref) || (actionLabel && onAction) ? (
        <div className="relative mt-2">
          {actionHref ? (
            <Button asChild className="yellow-btn h-auto px-4 py-2 text-xs">
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          ) : (
            <Button type="button" onClick={onAction} className="yellow-btn h-auto px-4 py-2 text-xs">
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
