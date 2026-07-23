'use client';

import CandlestickChart from './CandlestickChart';
import SignalBadges, { IndicatorPanel } from './SignalBadges';
import WatchlistButton from '@/components/watchlist/WatchlistButton';
import { formatPrice } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

type StockChartSectionProps = {
  symbol: string;
  company: string;
  isInWatchlist: boolean;
  chartData: Awaited<ReturnType<typeof import('@/lib/actions/market.actions').getChartData>>;
  aiSummary?: string | null;
};

export default function StockChartSection({
  symbol,
  company,
  isInWatchlist,
  chartData,
  aiSummary,
}: StockChartSectionProps) {
  const price = chartData.quote?.price;
  const change = chartData.quote?.changePercent;
  const up = (change ?? 0) >= 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#F5F5F5]">{company}</h1>
          <p className="mono text-sm text-[#6E6E6E]">{symbol}</p>
          {price != null && (
            <p className="mono mt-2 text-3xl font-medium text-[#F5F5F5]">
              {formatPrice(price)}
              {change != null && (
                <span className={`ml-2 text-base ${up ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  {up ? '+' : ''}
                  {change.toFixed(2)}%
                </span>
              )}
            </p>
          )}
        </div>
        <WatchlistButton symbol={symbol} company={company} isInWatchlist={isInWatchlist} />
      </div>

      <div className="surface-card p-2 md:p-3">
        <CandlestickChart
          data={{
            candles: chartData.candles,
            indicators: chartData.indicators,
          }}
        />
      </div>

      <IndicatorPanel indicators={chartData.indicators} />
      <SignalBadges signals={chartData.signals} />

      <div className="rounded-xl border border-[#242424] border-l-2 border-l-[#FDD458] bg-[#141414] p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#FDD458]" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold text-[#F5F5F5]">AI Analysis</h2>
        </div>
        <p className="text-sm leading-relaxed text-[#A1A1A1]">
          {aiSummary ||
            (chartData.indicators
              ? `RSI at ${chartData.indicators.rsi14.toFixed(1)}. MACD histogram ${chartData.indicators.macd.histogram >= 0 ? 'positive' : 'negative'}. Use Research for a full AI report.`
              : 'Insufficient market data for analysis.')}
        </p>
      </div>
    </div>
  );
}
