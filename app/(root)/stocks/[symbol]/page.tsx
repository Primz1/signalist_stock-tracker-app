import StockChartSection from '@/components/charts/StockChartSection';
import { getChartData } from '@/lib/actions/market.actions';
import { getStockProfile } from '@/lib/actions/finnhub.actions';
import { listWatchlistSymbols } from '@/lib/actions/watchlist.actions';
import { getLatestAiReport } from '@/database/models/aiReport.model';
import { connectToDatabase } from '@/database/mongoose';
import { getStockScore } from '@/database/models/stockScore.model';
import { PageEnter } from '@/components/ui/motion';
import Link from 'next/link';

export default async function StockDetails({ params }: StockDetailsPageProps) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();

  const [chartData, symbolsRes, profile] = await Promise.all([
    getChartData(sym, '1D'),
    listWatchlistSymbols(),
    getStockProfile(sym),
  ]);

  // If 1D came back empty even after server fallback, try 3M for a usable first paint
  const initialChart =
    chartData.candles.length > 0 ? chartData : await getChartData(sym, '3M');

  const isInWatchlist = symbolsRes.success
    ? symbolsRes.data.map((s) => s.toUpperCase()).includes(sym)
    : false;

  await connectToDatabase();
  const [aiReport, score] = await Promise.all([
    getLatestAiReport(sym),
    getStockScore(sym),
  ]);

  const company = profile?.name || sym;
  const exchange = profile?.exchange;
  const logo = profile?.logo;

  return (
    <PageEnter className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-1 md:px-0">
      <div className="text-xs uppercase tracking-[0.02em] text-[#6E6E6E]">
        <Link href="/watchlist" className="hover:text-[#FDD458]">
          Watchlist
        </Link>
        <span className="mx-1.5 text-[#2E2E2E]">/</span>
        <span className="mono text-[#A1A1A1]">{sym}</span>
      </div>

      <StockChartSection
        symbol={sym}
        company={company}
        exchange={exchange}
        logo={logo}
        isInWatchlist={isInWatchlist}
        chartData={initialChart}
        aiSummary={aiReport?.summary ?? null}
        aiScore={score?.score ?? null}
      />
    </PageEnter>
  );
}
