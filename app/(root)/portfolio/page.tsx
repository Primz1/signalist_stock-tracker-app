import { getPortfolio } from '@/lib/actions/portfolio.actions';
import PortfolioClient from '@/components/portfolio/PortfolioClient';

export default async function PortfolioPage() {
  const res = await getPortfolio();
  const initial = res.success
    ? (res.data as Parameters<typeof PortfolioClient>[0]['initial'])
    : {
        cash: 10000,
        initialCash: 10000,
        holdings: [],
        totalValue: 10000,
        plTotal: 0,
        plPercent: 0,
      };

  return <PortfolioClient initial={initial} />;
}
