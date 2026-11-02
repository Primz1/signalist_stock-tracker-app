import { redirect } from 'next/navigation';
import TelemetryClient from '@/components/telemetry/TelemetryClient';
import { getCachedUser } from '@/lib/auth/session';
import { getLatestPrices, getRecentEvents } from '@/lib/events/publisher';
import { getTrackedSymbols } from '@/lib/market/tracked-symbols';

export default async function SignalsPage() {
  const user = await getCachedUser();
  if (!user) redirect('/sign-in');

  const symbols = await getTrackedSymbols(user.id);
  const [events, prices] = await Promise.all([
    getRecentEvents({ userId: user.id, symbols, limit: 100 }),
    getLatestPrices(symbols),
  ]);

  return <TelemetryClient symbols={symbols} initialEvents={events} initialPrices={Object.fromEntries(prices)} />;
}
