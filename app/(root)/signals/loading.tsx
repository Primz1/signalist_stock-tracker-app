import { ShimmerBlock } from '@/components/ui/motion';

export default function Loading() {
  return (
    <div className="space-y-6">
      <ShimmerBlock className="h-10 w-40" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <ShimmerBlock key={i} className="h-20" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <ShimmerBlock className="h-96" />
        <ShimmerBlock className="h-96" />
      </div>
    </div>
  );
}
