'use client';

import { useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { runAiResearch, type ResearchFullResult } from '@/lib/actions/ai.actions';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';

function pct(v?: number | null, digits = 1) {
  if (v == null || Number.isNaN(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

function num(v?: number | null, digits = 2) {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toFixed(digits);
}

function FactorCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#242424] bg-[#0A0A0A]/60 p-3">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#6E6E6E]">
        {title}
      </div>
      <div className="space-y-1 text-[12px] text-[#A1A1A1]">{children}</div>
    </div>
  );
}

export default function ResearchClient() {
  const searchParams = useSearchParams();
  const [symbol, setSymbol] = useState(searchParams.get('symbol') || 'AAPL');
  const [query, setQuery] = useState(
    `Should I watch ${searchParams.get('symbol') || 'AAPL'}?`
  );
  const [report, setReport] = useState<ResearchFullResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await runAiResearch(symbol, query);
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      setReport(res.data);
      toast.success('Quant research ready');
    });
  };

  const snap = report?.snapshot as Record<string, any> | undefined;
  const narrative = report?.narrative as Record<string, any> | undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="section-title">AI Research Agent</h1>
        <p className="text-sm text-[#6E6E6E]">
          Quant factors first, Gemini narration second — numbers come from the snapshot.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="Symbol"
          className="form-input sm:w-32"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Your question"
          className="form-input flex-1"
        />
        <Button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="yellow-btn"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Computing…
            </>
          ) : (
            'Research'
          )}
        </Button>
      </form>

      {isPending && !report && (
        <div
          className="space-y-4"
          aria-busy="true"
          aria-label="Computing research"
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border border-[#242424] bg-[#1C1C1C]"
              />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-xl border border-[#242424] bg-[#1C1C1C]" />
        </div>
      )}

      {report && (
        <div className="space-y-4">
          {snap && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <FactorCard title="Returns">
                <div>1D {pct(snap.returns?.r_1d)}</div>
                <div>1M {pct(snap.returns?.r_1m)}</div>
                <div>3M {pct(snap.returns?.r_3m)}</div>
                <div>YTD {pct(snap.returns?.r_ytd)}</div>
              </FactorCard>
              <FactorCard title="Trend">
                <div>Price {num(snap.trend?.price)}</div>
                <div>Above SMA20 {String(snap.trend?.above_sma_20 ?? '—')}</div>
                <div>Above SMA50 {String(snap.trend?.above_sma_50 ?? '—')}</div>
                <div>Above SMA200 {String(snap.trend?.above_sma_200 ?? '—')}</div>
                {(snap.trend?.golden_cross_recent || snap.trend?.death_cross_recent) && (
                  <div className="text-[#FDD458]">
                    {snap.trend?.golden_cross_recent ? 'Golden cross' : 'Death cross'}
                  </div>
                )}
              </FactorCard>
              <FactorCard title="Momentum">
                <div title="RSI = 100 − (100 / (1 + avg gain / avg loss))">
                  RSI14 {num(snap.momentum?.rsi_14, 1)}
                </div>
                <div>MACD hist {num(snap.momentum?.macd_hist, 3)}</div>
                <div>ROC20 {pct(snap.momentum?.roc_20)}</div>
                <div>vs 52w hi {pct(snap.momentum?.distance_from_52w_high_pct)}</div>
              </FactorCard>
              <FactorCard title="Volatility">
                <div title="std(log returns, 20) × √252">
                  RV20 {pct(snap.volatility?.realized_vol_20d_annualized)}
                </div>
                <div>ATR14 {num(snap.volatility?.atr_14)}</div>
                <div>%B {num(snap.volatility?.bollinger_pct_b, 2)}</div>
                <div>BW {num(snap.volatility?.bollinger_bandwidth, 3)}</div>
              </FactorCard>
              <FactorCard title="Volume">
                <div>vs 20D {num(snap.volume?.volume_ratio_20d, 2)}×</div>
                <div>OBV slope {num(snap.volume?.obv_slope_20, 0)}</div>
                <div>Score {snap.score?.total ?? '—'}/100</div>
              </FactorCard>
              <FactorCard title="Levels">
                <div>Support {num(snap.levels?.nearest_support)}</div>
                <div>Resistance {num(snap.levels?.nearest_resistance)}</div>
              </FactorCard>
              <FactorCard title="Relative">
                <div>β SPY {num(snap.relative?.beta_vs_primary_60d)}</div>
                <div>Excess 1M {pct(snap.relative?.excess_return_1m)}</div>
                <div>Corr {num(snap.relative?.correlation_vs_primary, 2)}</div>
              </FactorCard>
              <FactorCard title="Quality">
                <div>PE {num(snap.quality?.pe, 1)}</div>
                <div>Op. margin {num(snap.quality?.operating_margin, 1)}</div>
                <div>D/E {num(snap.quality?.debt_to_equity, 2)}</div>
              </FactorCard>
              <FactorCard title="Event">
                <div>Days to earn {snap.event?.days_to_next_earnings ?? '—'}</div>
              </FactorCard>
            </div>
          )}

          <div className="space-y-4 rounded-xl border border-[#242424] border-l-2 border-l-[#FDD458] bg-[#141414] p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-[#FDD458]" strokeWidth={1.5} />
                <h2 className="text-lg font-semibold text-[#F5F5F5]">Narrative</h2>
              </div>
              <span className="text-xs text-[#6E6E6E]">
                Confidence: {((report.confidence ?? 0) * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-sm leading-relaxed text-[#A1A1A1]">{report.summary}</p>
            {narrative && (
              <div className="grid gap-2 text-[13px] text-[#A1A1A1] md:grid-cols-2">
                {['trend_read', 'momentum_read', 'volatility_read', 'relative_read', 'levels_read', 'caveats'].map(
                  (k) =>
                    narrative[k] ? (
                      <div key={k} className="rounded-lg bg-[#0A0A0A]/50 p-3">
                        <div className="mb-1 text-[10px] uppercase tracking-wide text-[#6E6E6E]">
                          {k.replace('_read', '').replace('_', ' ')}
                        </div>
                        {String(narrative[k])}
                      </div>
                    ) : null
                )}
              </div>
            )}

            {report.signals?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {report.signals.map((s) => (
                  <span
                    key={s.label}
                    className="rounded-full border border-[#2E2E2E] px-3 py-1 text-xs text-[#A1A1A1]"
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            )}

            {report.sources && report.sources.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-[#6E6E6E]">Sources</h3>
                <ul className="space-y-1 text-sm">
                  {report.sources.map((src, i) => (
                    <li key={i}>
                      {src.url ? (
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#FDD458] hover:underline"
                        >
                          {src.title}
                        </a>
                      ) : (
                        <span className="text-[#A1A1A1]">{src.title}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
