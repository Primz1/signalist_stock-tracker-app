import { ShimmerBlock } from '@/components/ui/motion';

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-busy="true" aria-label="Loading signal">
      <ShimmerBlock className="h-6 w-32" />
      <ShimmerBlock className="h-10 w-80" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <ShimmerBlock key={i} className="h-16" />
        ))}
      </div>
      <ShimmerBlock className="h-48" />
      <ShimmerBlock className="h-64" />
    </div>
  );
}
