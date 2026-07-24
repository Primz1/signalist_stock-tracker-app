'use client';

import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfidenceMeter } from '@/components/ui/confidence-meter';
import { cn } from '@/lib/utils';
import type { MarketingLiveData } from '@/lib/marketing/live-data';

type Props = {
  data: MarketingLiveData;
};

/** Live product chrome — P2 Tabs centered; values from Finnhub / DB. */
export function ProductPreview({ data }: Props) {
  const { hero, watchlist, movers, research, stats } = data;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-[rgba(253,212,88,0.2)] bg-[#141414] shadow-[0_0_60px_-20px_rgba(249,115,22,0.35)]">
      <div className="flex h-8 items-center gap-1.5 border-b border-[#242424] bg-[#1C1C1C] px-3">
        <span className="size-2 rounded-full bg-[#2E2E2E]" />
        <span className="size-2 rounded-full bg-[#2E2E2E]" />
        <span className="size-2 rounded-full bg-[#2E2E2E]" />
        <span className="mono ml-3 text-[10px] text-[#6E6E6E]">
          app.signalist · {hero.symbol}
        </span>
      </div>
      <div className="grid gap-0 md:grid-cols-[56px_1fr]">
        <div className="hidden flex-col items-center gap-3 border-r border-[#242424] bg-[#0A0A0A] py-3 md:flex">
          {['D', 'W', 'P', 'R'].map((l, i) => (
            <div
              key={l}
              className={cn(
                'flex size-8 items-center justify-center rounded-lg text-[11px] font-semibold text-[#6E6E6E]',
                i === 0 && 'bg-[#FDD458]/15 text-[#FDD458]'
              )}
            >
              {l}
            </div>
          ))}
        </div>
        <div className="p-3 md:p-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-[#6E6E6E]">
                {hero.symbol} · Live
              </div>
              <div className="mono text-2xl font-medium text-[#F5F5F5] md:text-3xl">
                ${hero.price}
              </div>
              <div className={cn('mono text-xs', hero.up ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                {hero.change}
              </div>
            </div>
            {hero.aiScore != null && (
              <div className="rounded-lg border border-[#FDD458]/35 bg-[#FDD458]/10 px-2.5 py-1 text-[11px] text-[#FDD458]">
                AI Score {hero.aiScore}
              </div>
            )}
          </div>

          <div className="relative h-36 overflow-hidden rounded-lg border border-[#242424] bg-[#0A0A0A] md:h-44">
            <svg viewBox="0 0 400 120" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="pvFillLive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FDD458" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#FDD458" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,80 C40,78 60,50 90,55 C120,60 140,30 180,35 C220,40 250,20 290,25 C330,30 360,12 400,18 L400,120 L0,120 Z"
                fill="url(#pvFillLive)"
              />
              <path
                d="M0,80 C40,78 60,50 90,55 C120,60 140,30 180,35 C220,40 250,20 290,25 C330,30 360,12 400,18"
                fill="none"
                stroke="#FDD458"
                strokeWidth="2"
                className="animate-drawline"
                pathLength={1000}
              />
            </svg>
            <div className="absolute left-3 top-2 mono text-[10px] text-[#A1A1A1]">
              {hero.symbol} · 1D
            </div>
          </div>

          {/* Centered P2 Tabs — live counts in triggers */}
          <Tabs defaultValue="watchlist" className="mt-4">
            <div className="flex justify-center">
              <TabsList className="w-full max-w-md justify-center sm:w-auto">
                <TabsTrigger value="watchlist" className="flex-1 gap-1.5 sm:flex-none">
                  Watchlist
                  <span className="mono text-[10px] text-[#FDD458]">{stats.watchlistCount}</span>
                </TabsTrigger>
                <TabsTrigger value="alerts" className="flex-1 gap-1.5 sm:flex-none">
                  Alerts
                  <span className="mono text-[10px] text-[#FDD458]">{stats.alertCount}</span>
                </TabsTrigger>
                <TabsTrigger value="research" className="flex-1 gap-1.5 sm:flex-none">
                  Research
                  <span className="mono text-[10px] text-[#FDD458]">{stats.researchLabel}</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="watchlist" className="mt-3 space-y-1.5">
              {watchlist.slice(0, 4).map((q) => (
                <div
                  key={q.symbol}
                  className="flex items-center justify-between rounded-lg bg-[#0A0A0A]/80 px-3 py-2"
                >
                  <span className="mono text-sm text-[#F5F5F5]">{q.symbol}</span>
                  <div className="flex items-center gap-3">
                    <span className="mono text-xs text-[#A1A1A1]">${q.price}</span>
                    <span className={cn('mono text-xs', q.up ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                      {q.change}
                    </span>
                  </div>
                </div>
              ))}
              <Link
                href="/sign-in?callbackUrl=%2Fwatchlist"
                className="block pt-1 text-center text-[11px] text-[#FDD458] hover:underline"
              >
                Open watchlist →
              </Link>
            </TabsContent>

            <TabsContent value="alerts" className="mt-3 space-y-1.5">
              {movers.slice(0, 4).map((q) => (
                <div
                  key={`a-${q.symbol}`}
                  className="flex items-center justify-between rounded-lg border border-[#242424] bg-[#0A0A0A]/80 px-3 py-2"
                >
                  <div>
                    <div className="mono text-sm text-[#F5F5F5]">{q.symbol}</div>
                    <div className="text-[10px] text-[#6E6E6E]">
                      {q.up ? 'Upper threshold proximity' : 'Lower threshold proximity'}
                    </div>
                  </div>
                  <span className={cn('mono text-xs', q.up ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
                    {q.change}
                  </span>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="research" className="mt-3">
              <div className="rounded-lg border border-[#242424] border-l-2 border-l-[#FDD458] bg-[#0A0A0A]/80 p-3">
                <div className="text-[10px] uppercase tracking-wide text-[#6E6E6E]">
                  {research?.symbol ?? hero.symbol} · Narrative
                </div>
                <p className="mt-1 text-sm leading-snug text-[#F5F5F5]">
                  {research?.summary ?? 'Run AI research after sign-in for grounded factor narratives.'}
                </p>
                <ConfidenceMeter
                  className="mt-3"
                  value={research?.confidence ?? hero.aiScore ?? 70}
                  label="Confidence"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
