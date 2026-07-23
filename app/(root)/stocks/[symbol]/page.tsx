import StockChartSection from '@/components/charts/StockChartSection';
import { getChartData } from '@/lib/actions/market.actions';
import { listWatchlistSymbols } from '@/lib/actions/watchlist.actions';
import { getLatestAiReport } from '@/database/models/aiReport.model';
import { connectToDatabase } from '@/database/mongoose';
import { getStockScore } from '@/database/models/stockScore.model';
import Link from 'next/link';

export default async function StockDetails({ params }: StockDetailsPageProps) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();

  const [chartData, symbolsRes] = await Promise.all([
    getChartData(sym),
    listWatchlistSymbols(),
  ]);

  const isInWatchlist = symbolsRes.success
    ? symbolsRes.data.map((s) => s.toUpperCase()).includes(sym)
    : false;

  await connectToDatabase();
  const [aiReport, score] = await Promise.all([
    getLatestAiReport(sym),
    getStockScore(sym),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/watchlist" className="text-[#6E6E6E] hover:text-[#FDD458]">
          Watchlist
        </Link>
        <span className="text-[#2E2E2E]">/</span>
        <span className="mono text-[#F5F5F5]">{sym}</span>
        {score && (
          <span className="ml-auto rounded-full bg-[rgba(253,212,88,0.12)] px-3 py-1 text-xs text-[#FDD458]">
            AI Score: {score.score}/100
          </span>
        )}
      </div>

      <StockChartSection
        symbol={sym}
        company={sym}
        isInWatchlist={isInWatchlist}
        chartData={chartData}
        aiSummary={aiReport?.summary ?? null}
      />

      <div className="text-center">
        <Link
          href={`/research?symbol=${sym}`}
          className="text-sm text-[#FDD458] hover:underline"
        >
          Run full AI research on {sym} →
        </Link>
      </div>
    </div>
  );
}
