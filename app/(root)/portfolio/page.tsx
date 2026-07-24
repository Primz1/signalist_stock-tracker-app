import { getPortfolio, getTradeHistory } from '@/lib/actions/portfolio.actions';
import PortfolioClient from '@/components/portfolio/PortfolioClient';

export default async function PortfolioPage() {
  const [res, histRes] = await Promise.all([
    getPortfolio(),
    getTradeHistory({ range: '7d' }),
  ]);
  const initial = res.success
    ? (res.data as Parameters<typeof PortfolioClient>[0]['initial'])
    : {
        cash: 10000,
        initialCash: 10000,
        holdings: [],
        totalValue: 10000,
        plTotal: 0,
        plPercent: 0,
        dayPl: 0,
        dayPlPercent: 0,
      };

  const initialRecent = histRes.success ? histRes.data.trades.slice(0, 8) : [];

  return <PortfolioClient initial={initial} initialRecent={initialRecent} />;
}
