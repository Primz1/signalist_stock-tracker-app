import { Skeleton } from '@/components/ui/skeleton';

type Variant = 'default' | 'dashboard' | 'table' | 'form' | 'stock';

/**
 * Lightweight route-level skeleton shared by app/(root) loading.tsx files.
 */
export default function RouteLoadingSkeleton({
  variant = 'default',
}: {
  variant?: Variant;
}) {
  if (variant === 'form') {
    return (
      <div className="mx-auto max-w-2xl space-y-6" aria-busy="true" aria-label="Loading">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="space-y-4 rounded-xl border border-[#242424] bg-[#141414] p-5">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (variant === 'stock') {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading stock">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ml-auto h-6 w-24 rounded-full" />
        </div>
        <Skeleton className="h-[360px] w-full rounded-xl" />
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
        <Skeleton className="h-8 w-full rounded-lg" />
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-4 w-64" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
          </div>
          <Skeleton className="min-h-[240px] flex-1 rounded-xl" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  // default / portfolio / research style
  return (
    <div className="mx-auto max-w-[1100px] space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
