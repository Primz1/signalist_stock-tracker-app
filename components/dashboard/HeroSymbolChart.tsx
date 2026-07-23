'use client';

import CandlestickChart from '@/components/charts/CandlestickChart';

type ChartPayload = Awaited<ReturnType<typeof import('@/lib/actions/market.actions').getChartData>>;

export default function HeroSymbolChart({
  symbol,
  chartData,
}: {
  symbol: string;
  chartData: ChartPayload;
}) {
  if (!chartData.candles?.length) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[13px] text-[#6E6E6E]">
        No chart data for {symbol}
      </div>
    );
  }

  return (
    <CandlestickChart
      data={{
        candles: chartData.candles,
        indicators: chartData.indicators,
      }}
      height={220}
      showMA
    />
  );
}
