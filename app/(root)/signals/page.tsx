import { redirect } from 'next/navigation';
import SignalsClient from '@/components/signals/SignalsClient';
import { getCachedUser } from '@/lib/auth/session';
import { getRecentEvents } from '@/lib/events/publisher';
import { getMarketPulse, getSignalDetail, lastAnalysisAt, listSignals } from '@/lib/intelligence/queries';
import { getTrackedSymbols } from '@/lib/market/tracked-symbols';

export default async function SignalsPage({ searchParams }: { searchParams: Promise<{ signal?: string }> }) {
  const user = await getCachedUser();
  if (!user) redirect('/sign-in');

  const [{ signal: requested }, symbols] = await Promise.all([searchParams, getTrackedSymbols(user.id)]);
  const [signals, pulse, events, lastAnalysis] = await Promise.all([
    listSignals(),
    getMarketPulse(symbols),
    getRecentEvents({ userId: user.id, symbols, limit: 50 }),
    lastAnalysisAt(),
  ]);
  const selected = requested ?? signals[0]?.signalId;
  const initialDetail = selected ? await getSignalDetail(selected) : null;

  return (
    <SignalsClient
      symbols={symbols}
      initialSignals={signals}
      initialDetail={initialDetail}
      pulse={pulse}
      initialEvents={events}
      lastAnalysis={lastAnalysis}
    />
  );
}
