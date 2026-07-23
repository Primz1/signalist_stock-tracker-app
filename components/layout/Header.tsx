import AppHeader from './AppHeader';
import { searchStocks } from '@/lib/actions/finnhub.actions';
import { listWatchlistSymbols } from '@/lib/actions/watchlist.actions';

const Header = async ({ user }: { user: User }) => {
  const initialStocks = await searchStocks();
  const symbolsRes = await listWatchlistSymbols();
  const watchlistSymbols = symbolsRes.success ? symbolsRes.data : [];

  return (
    <AppHeader
      user={user}
      initialStocks={initialStocks}
      watchlistSymbols={watchlistSymbols}
    />
  );
};

export default Header;
