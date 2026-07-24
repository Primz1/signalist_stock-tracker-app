import { Suspense } from 'react';
import RouteLoadingSkeleton from '@/components/layout/RouteLoadingSkeleton';
import ResearchClient from '@/components/research/ResearchClient';
import { listWatchlistSymbols } from '@/lib/actions/watchlist.actions';

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>;
}) {
  const params = await searchParams;
  const wl = await listWatchlistSymbols();
  const watchlist = wl.success ? wl.data.map((s) => s.toUpperCase()) : [];
  const initialSymbol = (params.symbol || watchlist[0] || '').toUpperCase();

  return (
    <Suspense fallback={<RouteLoadingSkeleton variant="research" />}>
      <ResearchClient initialSymbols={watchlist} initialSymbol={initialSymbol} />
    </Suspense>
  );
}
