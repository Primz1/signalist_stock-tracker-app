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
                className="size-10 rounded-lg bg-surface-2 object-contain p-1"
              />
            ) : (
              <div className="mono flex size-10 items-center justify-center rounded-lg bg-surface-3 text-sm font-semibold text-ink">
                {initials(company, symbol)}
              </div>
            )}
            <h1 className="page-title">{company}</h1>
            <span className="mono text-[13px] text-ink-2">({symbol})</span>
            {exchange ? (
              <span className="rounded border border-line-strong px-1.5 py-0.5 text-[12px] text-ink-3">
                {exchange.split(/[\s/-]/)[0] || exchange}
              </span>
            ) : null}
          </div>

          <div className="mb-1.5 flex flex-wrap items-baseline gap-3">
            {price != null ? (
              <div className="figure text-[40px] leading-[44px] text-ink">
                {formatPrice(price)}
              </div>
            ) : null}
            {changePct != null ? (
              <span
                className={cn(
                  'mono text-[15px]',
                  up ? 'text-up' : 'text-down'
                )}
              >
                {change != null
                  ? `${up ? '+' : ''}${change.toFixed(2)} (${up ? '+' : ''}${changePct.toFixed(2)}%)`
                  : `${up ? '+' : ''}${changePct.toFixed(2)}%`}
              </span>
            ) : null}
          </div>

          <div className="mono text-[13px] text-ink-3">
            O {open != null ? open.toFixed(2) : '—'} · H {high != null ? high.toFixed(2) : '—'} · L{' '}
            {low != null ? low.toFixed(2) : '—'} · C {close != null ? close.toFixed(2) : '—'} · Vol{' '}
            {formatVol(vol)}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2.5 md:items-end">
          {aiScore != null && Number.isFinite(aiScore) ? (
            <span
              className="mono text-[14px] text-ink-2"
            >
              AI score{' '}
              <span className={aiScore >= 60 ? 'text-up' : aiScore >= 40 ? 'text-ink' : 'text-down'}>
                {Math.round(aiScore)}
              </span>
              <span className="text-ink-3">/100</span>
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
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex gap-0.5 rounded-lg border border-line bg-canvas p-0.5" role="group" aria-label="Chart range">
            {CHART_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => loadRange(r)}
                aria-pressed={range === r}
                className={cn(
                  'mono h-7 rounded-md px-2.5 text-[12px] transition-colors duration-150',
                  range === r
                    ? 'bg-surface-2 text-ink'
                    : 'bg-transparent text-ink-2 hover:text-ink'
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
                  aria-pressed={on}
                  className={cn(
                    'h-7 rounded-md border px-2.5 text-[12px] transition-colors duration-150',
                    on
                      ? 'border-signal/50 bg-signal/10 text-signal'
                      : 'border-line-strong text-ink-3 hover:text-ink-2'
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
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/70">
              <Loader2 className="size-5 animate-spin text-signal" />
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
        className="mb-6 rounded-lg border border-line bg-surface p-5 md:p-6"
      >
        <h2 className="section-title mb-3 flex items-center gap-2">
          <Sparkles className="size-4 text-signal" strokeWidth={1.5} />
          AI analysis
        </h2>
        <p className="mb-4 max-w-[72ch] text-[15px] leading-6 text-ink">
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
          className="inline-flex items-center gap-1.5 text-[14px] font-medium text-signal underline-offset-4 hover:underline"
        >
          Run full AI research on {symbol}
          <ExternalLink className="size-3.5" strokeWidth={1.5} />
        </Link>
      </div>
    </div>
  );
}
