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
      <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="flex flex-col gap-6 rounded-2xl border border-[#242424] bg-[#141414] p-5 lg:flex-row lg:p-7">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-12 w-full max-w-md" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
          </div>
          <Skeleton className="min-h-[240px] flex-1 rounded-xl" />
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-[220px] rounded-xl xl:col-span-1" />
          <Skeleton className="h-[220px] rounded-xl xl:col-span-2" />
          <Skeleton className="h-[220px] rounded-xl xl:col-span-1" />
          <Skeleton className="h-[220px] rounded-xl xl:col-span-2" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-48 w-full rounded-xl" />
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
            <Skeleton className="h-11 w-full rounded-xl" />
            <div className="overflow-hidden rounded-xl border border-[#242424]">
              <Skeleton className="h-10 w-full rounded-none" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-none border-t border-[#1C1C1C]" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      </div>
    );
  }

  if (variant === 'portfolio') {
    return (
      <div className="mx-auto max-w-[1100px]" aria-busy="true" aria-label="Loading portfolio">
        <div className="overflow-hidden rounded-2xl border border-[#242424] bg-[#141414]">
          <div className="border-b border-[#242424] px-5 py-6 md:px-8">
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
            <div className="space-y-0 border-b border-[#242424] lg:border-b-0 lg:border-r">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-none border-b border-[#1C1C1C]" />
              ))}
            </div>
            <div className="flex flex-col items-center gap-4 p-6">
              <Skeleton className="size-40 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="border-t border-[#242424] p-5">
            <Skeleton className="h-28 w-full rounded-xl" />
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
        <div className="space-y-3 rounded-xl border border-[#242424] bg-[#141414] p-4">
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
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <div className="overflow-hidden rounded-xl border border-[#242424]">
          <Skeleton className="h-10 w-full rounded-none" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-none border-t border-[#1C1C1C]" />
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
        <div className="flex gap-2 border-b border-[#242424] pb-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-56 w-full rounded-xl border-l-2 border-l-[#FDD458]" />
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
        <div className="overflow-hidden rounded-xl border border-[#242424] bg-[#141414]">
          <div className="flex items-center justify-between border-b border-[#242424] px-4 py-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-28" />
          </div>
          <Skeleton className="h-[360px] w-full rounded-none" />
          <div className="grid gap-3 border-t border-[#242424] p-4 md:grid-cols-4">
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
        <div className="space-y-4 rounded-xl border border-[#242424] bg-[#141414] p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="mt-2 h-12 w-full rounded-2xl" />
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
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-28" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl border border-dashed border-[#2E2E2E]" />
      <div className="space-y-2 rounded-xl border border-[#242424] p-4">
        <Skeleton className="mb-3 h-4 w-24" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}
