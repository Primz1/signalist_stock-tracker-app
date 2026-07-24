'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2, Sparkles } from 'lucide-react';
import CandlestickChart, { type IndicatorToggleKey } from './CandlestickChart';
import { IndicatorGuide, type ExtraIndicators } from './IndicatorGuide';
import SignalBadges from './SignalBadges';
import WatchlistButton from '@/components/watchlist/WatchlistButton';
import { getExtraIndicators } from '@/lib/actions/ai.actions';
import { getChartData } from '@/lib/actions/market.actions';
import { CHART_RANGES, type ChartRange } from '@/lib/market/ohlcv';
import { cn, formatPrice } from '@/lib/utils';

type ChartPayload = Awaited<ReturnType<typeof getChartData>>;

type StockChartSectionProps = {
  symbol: string;
  company: string;
  exchange?: string;
  logo?: string;
  isInWatchlist: boolean;
  chartData: ChartPayload;
  aiSummary?: string | null;
  aiScore?: number | null;
};

const TOGGLES: IndicatorToggleKey[] = ['SMA20', 'SMA50', 'RSI', 'MACD', 'BB'];

function formatVol(n?: number) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function initials(name: string, symbol: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return symbol.slice(0, 2).toUpperCase();
}

export default function StockChartSection({
  symbol,
  company,
  exchange,
  logo,
  isInWatchlist,
  chartData: initial,
  aiSummary,
  aiScore,
}: StockChartSectionProps) {
  const [range, setRange] = useState<ChartRange>((initial.range as ChartRange) || '1D');
  const [chartData, setChartData] = useState(initial);
  const [overlays, setOverlays] = useState<Record<IndicatorToggleKey, boolean>>({
    SMA20: true,
    SMA50: false,
    RSI: false,
    MACD: false,
    BB: false,
  });
  const [pending, startTransition] = useTransition();
  const [chartEpoch, setChartEpoch] = useState(0);
  const requestId = useRef(0);
  const [extras, setExtras] = useState<ExtraIndicators | null>(null);

  useEffect(() => {
    setChartData(initial);
    setRange((initial.range as ChartRange) || '1D');
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    getExtraIndicators(symbol).then((res) => {
      if (cancelled) return;
      if (res.success && res.data?.latest) setExtras(res.data.latest);
      else setExtras(null);
    });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const price = chartData.quote?.price;
  const changePct = chartData.quote?.changePercent;
  const change = chartData.quote?.change;
  const up = (changePct ?? 0) >= 0;
  const last = chartData.candles[chartData.candles.length - 1];

  const open = chartData.quote?.open ?? last?.open;
  const high = chartData.quote?.high ?? last?.high;
  const low = chartData.quote?.low ?? last?.low;
  const close = price ?? last?.close;
  const vol = chartData.quote?.volume ?? last?.volume;

  const loadRange = (next: ChartRange) => {
    if (next === range) return;
    setRange(next);
    const id = ++requestId.current;
    startTransition(async () => {
      try {
        const data = await getChartData(symbol, next);
        // Ignore stale responses if user clicked another range quickly
        if (id !== requestId.current) return;
        setChartData(data);
        setRange(data.range as ChartRange);
        setChartEpoch((e) => e + 1);
      } catch {
        if (id !== requestId.current) return;
        // keep prior candles; tab still shows selection
      }
    });
  };

  const toggleOverlay = (key: IndicatorToggleKey) => {
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="mb-3.5 flex flex-wrap items-center gap-3">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt=""
                className="size-10 rounded-full border border-[#242424] bg-[#1C1C1C] object-contain p-1"
              />
            ) : (
              <div className="mono flex size-10 items-center justify-center rounded-full bg-[rgba(253,212,88,0.12)] text-sm font-semibold text-[#F5F5F5]">
                {initials(company, symbol)}
              </div>
            )}
            <h1 className="text-2xl font-semibold leading-8 text-[#F5F5F5]">{company}</h1>
            <span className="mono text-[13px] text-[#A1A1A1]">({symbol})</span>
            {exchange ? (
              <span className="rounded border border-[#2E2E2E] px-1.5 py-0.5 text-[11px] text-[#6E6E6E]">
                {exchange.split(/[\s/-]/)[0] || exchange}
              </span>
            ) : null}
          </div>

          <div className="mb-1.5 flex flex-wrap items-baseline gap-3">
            {price != null ? (
              <div className="mono text-[32px] font-medium leading-10 text-[#F5F5F5]">
                {formatPrice(price)}
              </div>
            ) : null}
            {changePct != null ? (
              <span
                className={cn(
                  'mono rounded-full px-2.5 py-0.5 text-[13px]',
                  up
                    ? 'bg-[rgba(34,197,94,0.12)] text-[#22C55E]'
                    : 'bg-[rgba(239,68,68,0.12)] text-[#EF4444]'
                )}
              >
                {change != null
                  ? `${up ? '+' : ''}${change.toFixed(2)} (${up ? '+' : ''}${changePct.toFixed(2)}%)`
                  : `${up ? '+' : ''}${changePct.toFixed(2)}%`}
              </span>
            ) : null}
          </div>

          <div className="mono text-xs text-[#A1A1A1]">
            O {open != null ? open.toFixed(2) : '—'} · H {high != null ? high.toFixed(2) : '—'} · L{' '}
            {low != null ? low.toFixed(2) : '—'} · C {close != null ? close.toFixed(2) : '—'} · Vol{' '}
            {formatVol(vol)}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2.5 md:items-end">
          {aiScore != null && Number.isFinite(aiScore) ? (
            <span
              className={cn(
                'mono rounded-full px-2.5 py-1 text-[13px]',
                aiScore >= 60
                  ? 'bg-[rgba(34,197,94,0.12)] text-[#22C55E]'
                  : aiScore >= 40
                    ? 'bg-[rgba(253,212,88,0.12)] text-[#FDD458]'
                    : 'bg-[rgba(239,68,68,0.12)] text-[#EF4444]'
              )}
            >
              AI Score {Math.round(aiScore)}/100
            </span>
          ) : null}
          <WatchlistButton
            symbol={symbol}
            company={company}
            isInWatchlist={isInWatchlist}
            variant="outline"
            showTrashIcon
          />
        </div>
      </div>

      <SignalBadges signals={chartData.signals} />

      {/* Chart */}
      <div className="overflow-hidden rounded-xl border border-[#242424] bg-[#141414]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#242424] px-4 py-3">
          <div className="flex gap-0.5 rounded-lg bg-[#0A0A0A] p-0.5">
            {CHART_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => loadRange(r)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-xs transition-colors',
                  range === r
                    ? 'bg-[#1C1C1C] text-[#F5F5F5]'
                    : 'bg-transparent text-[#A1A1A1] hover:text-[#F5F5F5]'
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {TOGGLES.map((key) => {
              const on = overlays[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleOverlay(key)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
                    on
                      ? 'border-[#FDD458] text-[#FDD458]'
                      : 'border-[#2E2E2E] text-[#6E6E6E] hover:border-[#3A3A3A] hover:text-[#A1A1A1]'
                  )}
                >
                  {key}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative p-4">
          {pending ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#141414]/70">
              <Loader2 className="size-5 animate-spin text-[#FDD458]" />
            </div>
          ) : null}
          <CandlestickChart
            key={`${symbol}-${range}-${chartEpoch}-${chartData.candles.length}-${chartData.candles[0]?.time ?? 0}-${chartData.candles.at(-1)?.time ?? 0}`}
            data={{
              candles: chartData.candles,
              indicators: chartData.indicators,
            }}
            overlays={overlays}
            height={360}
          />
        </div>
      </div>

      {chartData.indicators ? (
        <IndicatorGuide indicators={chartData.indicators} price={price} extras={extras} />
      ) : null}

      {/* AI analysis */}
      <div
        className="mb-6 rounded-xl border border-[#242424] border-l-2 border-l-[#FDD458] bg-[#141414] p-5"
        style={{ boxShadow: '0 0 40px -24px rgba(249,115,22,0.4)' }}
      >
        <div className="mb-3 flex items-center gap-1.5">
          <Sparkles className="size-4 text-[#FDD458]" strokeWidth={1.5} />
          <span className="text-xs uppercase tracking-[0.02em] text-[#6E6E6E]">AI analysis</span>
        </div>
        <p className="mb-3.5 text-sm leading-5 text-[#F5F5F5]">
          {aiSummary ||
            (chartData.indicators
              ? `${company} shows ${
                  chartData.indicators.sma20 >= chartData.indicators.sma50
                    ? 'price holding above the longer moving average'
                    : 'price below the longer moving average'
                } with RSI at ${chartData.indicators.rsi14.toFixed(0)}. MACD histogram is ${
                  chartData.indicators.macd.histogram >= 0 ? 'positive' : 'negative'
                }. Run full research for a deeper thesis.`
              : 'Insufficient market data for analysis.')}
        </p>
        <Link
          href={`/research?symbol=${symbol}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-[#FDD458] hover:underline"
        >
          Run full AI research on {symbol}
          <ExternalLink className="size-3.5" strokeWidth={1.5} />
        </Link>
      </div>
    </div>
  );
}
