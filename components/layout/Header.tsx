import { unstable_cache } from 'next/cache';
import AppHeader from './AppHeader';
import { searchStocks } from '@/lib/actions/finnhub.actions';
import { listWatchlistSymbols } from '@/lib/actions/watchlist.actions';
import { getNotifications } from '@/lib/actions/alertNotification.actions';

const getCachedPopularStocks = unstable_cache(
  async () => searchStocks(),
  ['header-popular-stocks'],
  { revalidate: 60 }
);

const Header = async ({ user }: { user: User }) => {
  const [initialStocks, symbolsRes, notifRes] = await Promise.all([
    getCachedPopularStocks(),
    listWatchlistSymbols(),
    getNotifications(),
  ]);
  const watchlistSymbols = symbolsRes.success ? symbolsRes.data : [];
  const notifications = notifRes.success
    ? (notifRes.data as {
        _id?: string;
        symbol: string;
        message: string;
        triggeredAt: string;
        read: boolean;
      }[])
    : [];

  return (
    <AppHeader
      user={user}
      initialStocks={initialStocks}
      watchlistSymbols={watchlistSymbols}
      initialNotifications={notifications}
    />
  );
};

export default Header;
