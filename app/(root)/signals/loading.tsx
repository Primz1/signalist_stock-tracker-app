import { ShimmerBlock } from '@/components/ui/motion';

export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading signals">
      <div className="space-y-3">
        <ShimmerBlock className="h-10 w-40" />
        <ShimmerBlock className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <ShimmerBlock key={i} className="h-20" />
        ))}
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-3">
          <ShimmerBlock className="h-9 w-72" />
          {Array.from({ length: 6 }, (_, i) => (
            <ShimmerBlock key={i} className="h-14" />
          ))}
        </div>
        <ShimmerBlock className="hidden h-[32rem] lg:block" />
      </div>
    </div>
  );
}
