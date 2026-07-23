import { Suspense } from 'react';
import RouteLoadingSkeleton from '@/components/layout/RouteLoadingSkeleton';
import ResearchClient from '@/components/research/ResearchClient';

export default function ResearchPage() {
  return (
    <Suspense fallback={<RouteLoadingSkeleton />}>
      <ResearchClient />
    </Suspense>
  );
}
