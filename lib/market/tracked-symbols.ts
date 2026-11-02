import { connectToDatabase } from '@/database/mongoose';
import { Alert } from '@/database/models/alert.model';
import { PortfolioModel } from '@/database/models/portfolio.model';
import { Watchlist } from '@/database/models/watchlist.model';

/** Every symbol a user follows: watchlist, paper holdings and active alerts. */
export async function getTrackedSymbols(userId: string): Promise<string[]> {
  await connectToDatabase();
  const [watchlist, holdings, alerts] = await Promise.all([
    Watchlist.distinct('symbol', { userId }),
    PortfolioModel.distinct('holdings.symbol', { userId }),
    Alert.distinct('symbol', { userId, isActive: true }),
  ]);
  return Array.from(new Set([...watchlist, ...holdings, ...alerts].map((s) => String(s).toUpperCase()))).sort();
}
