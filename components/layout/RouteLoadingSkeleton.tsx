import { Skeleton } from '@/components/ui/skeleton';

type Variant =
  | 'dashboard'
  | 'watchlist'
  | 'portfolio'
  | 'history'
  | 'research'
  | 'stock'
  | 'settings'
  | 'developers';

/**
 * Per-route loading skeletons — each mirrors that page’s layout, not a shared generic block.
 */
export default function RouteLoadingSkeleton({
  variant,
}: {
  variant: Variant;
}) {
  if (variant === 'dashboard') {
    return (
      <div className="space-y-12" aria-busy="true" aria-label="Loading dashboard">
        <Skeleton className="h-9 w-full rounded-none" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-5 h-3 w-32" />
            <Skeleton className="h-14 w-72" />
            <Skeleton className="h-4 w-80" />
            <Skeleton className="mt-6 h-16 w-full" />
            <div className="flex gap-2 pt-3">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
          <Skeleton className="min-h-[280px] rounded-lg" />
        </div>
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Skeleton className="h-[300px] rounded-lg" />
          <Skeleton className="h-[300px] rounded-lg" />
        </div>
      </div>
    );
  }

  if (variant === 'watchlist') {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading watchlist">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-40 rounded-lg" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-3">
            <Skeleton className="h-11 w-full rounded-lg" />
            <div className="overflow-hidden rounded-lg border border-line">
              <Skeleton className="h-10 w-full rounded-none" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-none border-t border-line" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-36 rounded-lg" />
          <Skeleton className="h-36 rounded-lg" />
          <Skeleton className="h-36 rounded-lg" />
        </div>
      </div>
    );
  }

  if (variant === 'portfolio') {
    return (
      <div className="mx-auto max-w-[1100px]" aria-busy="true" aria-label="Loading portfolio">
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <div className="border-b border-line px-5 py-6 md:px-8">
            <Skeleton className="mb-2 h-3 w-28" />
            <Skeleton className="h-9 w-48" />
            <Skeleton className="mt-2 h-4 w-40" />
            <div className="mt-6 flex flex-wrap gap-8">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
          <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-0 border-b border-line lg:border-b-0 lg:border-r">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-none border-b border-line" />
              ))}
            </div>
            <div className="flex flex-col items-center gap-4 p-6">
              <Skeleton className="size-40 rounded-lg" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="border-t border-line p-5">
            <Skeleton className="h-28 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'history') {
    return (
      <div className="mx-auto max-w-6xl space-y-6" aria-busy="true" aria-label="Loading trade history">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-36" />
          </div>
        </div>
        <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-12 rounded-md" />
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
        <div className="overflow-hidden rounded-lg border border-line">
          <Skeleton className="h-10 w-full rounded-none" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-none border-t border-line" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'research') {
    return (
      <div className="mx-auto max-w-4xl space-y-6" aria-busy="true" aria-label="Loading research">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-10 w-full sm:w-32" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="flex gap-2 border-b border-line pb-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-56 w-full rounded-lg border-l border-l-signal" />
      </div>
    );
  }

  if (variant === 'stock') {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading stock">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ml-auto h-8 w-40" />
        </div>
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-28" />
          </div>
          <Skeleton className="h-[360px] w-full rounded-none" />
          <div className="grid gap-3 border-t border-line p-4 md:grid-cols-4">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        </div>
        <Skeleton className="mx-auto h-4 w-56" />
      </div>
    );
  }

  if (variant === 'settings') {
    return (
      <div className="mx-auto max-w-lg space-y-5" aria-busy="true" aria-label="Loading settings">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4 rounded-lg border border-line bg-surface p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="mt-2 h-12 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // developers
  return (
    <div className="mx-auto max-w-2xl space-y-6" aria-busy="true" aria-label="Loading API">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-28 w-full rounded-lg" />
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-28" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg border border-dashed border-line-strong" />
      <div className="space-y-2 rounded-lg border border-line p-4">
        <Skeleton className="mb-3 h-4 w-24" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}
