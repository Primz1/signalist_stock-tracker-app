'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Play } from 'lucide-react';
import BrandLogo from '@/components/layout/BrandLogo';
import { DrawlineSpark } from '@/components/ui/drawline-spark';
import { KineticGrid } from '@/components/ui/kinetic-grid';
import { TickerMarquee } from '@/components/ui/ticker-marquee';
import { ConfidenceMeter } from '@/components/ui/confidence-meter';
import { MarketWatchlist } from '@/components/ui/market-watchlist';
import { SectorsDonut } from '@/components/ui/sectors-donut';
import {
  Ticker,
  TickerIcon,
  TickerPrice,
  TickerPriceChange,
  TickerSymbol,
} from '@/components/ui/ticker';
import { MarketingSearch } from '@/components/marketing/MarketingSearch';
import { ProductPreview } from '@/components/marketing/ProductPreview';
import { cn } from '@/lib/utils';
import type { MarketingLiveData, MarketingQuote } from '@/lib/marketing/live-data';

const FEATURES = [
  {
    title: 'Watchlists that actually alert',
    body: 'Track equities and crypto in one list. Price alerts fire when your levels hit — not when you remember to check.',
    bullets: ['Unified stock + crypto watchlist', 'Upper / lower price alerts', 'Recent alert inbox in the header'],
    href: '/sign-up',
    visual: 'watchlist' as const,
    reverse: false,
  },
  {
    title: 'Quant first, narrative second',
    body: 'Signalist computes factors in Python, then Gemini narrates only from cited numbers — so AI research stays grounded.',
    bullets: ['Typed factor snapshots', 'Confidence-scored narratives', 'Jump from any symbol into Research'],
    href: '/sign-up',
    visual: 'research' as const,
    reverse: true,
  },
  {
    title: 'Paper trade without the noise',
    body: 'Practice sizing and timing with a paper portfolio, allocation view, and trade history with realized P/L.',
    bullets: ['Instant paper tickets', 'Allocation breakdown', 'Undo window on recent trades'],
    href: '/sign-up',
    visual: 'portfolio' as const,
    reverse: false,
  },
];

const TESTIMONIALS = [
  {
    quote:
      'I stopped switching between four tabs. The AI score plus alerts caught a breakout I would\'ve missed.',
    author: '— 0xxghost, Retail Investor',
  },
  {
    quote: 'Feels like TradingView but with a research analyst built in. My most-used app now.',
    author: '— mkim_trades, Prosumer Trader',
  },
  {
    quote: 'The alerts alone paid for the upgrade. I never miss a threshold anymore.',
    author: '— dlrsn, Swing Trader',
  },
];

function MarketingHeader() {
  const links = [
    { href: '#product', label: 'Product' },
    { href: '#markets', label: 'Markets' },
    { href: '#research', label: 'Research' },
    { href: '/sign-up', label: 'API' },
    { href: '#cta', label: 'Pricing' },
  ];

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-6 border-b border-[#242424] bg-[#141414]/90 px-4 backdrop-blur-md md:px-8 lg:px-10">
      <Link href="/" className="flex flex-none items-center gap-2">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-[#FDD458] text-[14px] font-bold text-[#0A0A0A]">
          S
        </div>
        <span className="text-[14px] font-semibold text-[#F5F5F5]">Signalist</span>
      </Link>

      <div className="hidden flex-1 md:block" />
      <div className="hidden flex-none items-center gap-[22px] md:flex">
        <nav className="flex items-center gap-[22px]">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-[13px] text-[#A1A1A1] transition-colors hover:text-[#F5F5F5]"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <MarketingSearch />
      </div>
      <div className="hidden flex-1 md:block" />

      <div className="ml-auto flex flex-none items-center gap-3 md:ml-0">
        <MarketingSearch className="md:hidden" />
        <Link href="/sign-in" className="text-[13px] text-[#A1A1A1] hover:text-[#F5F5F5]">
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="rounded-lg bg-gradient-to-br from-[#FDD458] to-[#F97316] px-3.5 py-2 text-[13px] font-semibold text-[#0A0A0A]"
        >
          Get started
        </Link>
      </div>
    </header>
  );
}

function FeatureVisual({
  kind,
  data,
}: {
  kind: 'watchlist' | 'research' | 'portfolio';
  data: MarketingLiveData;
}) {
  if (kind === 'portfolio') {
    return (
      <SectorsDonut
        symbol="PAPER"
        caption="demo allocation"
        sectors={[
          { label: 'Technology', pct: 34 },
          { label: 'Consumer', pct: 18 },
          { label: 'Financials', pct: 14 },
          { label: 'Healthcare', pct: 12 },
          { label: 'Energy', pct: 10 },
          { label: 'Cash', pct: 12 },
        ]}
      />
    );
  }

  if (kind === 'research') {
    const conf = data.research?.confidence ?? data.hero.aiScore ?? 72;
    return (
      <div className="flex h-[220px] flex-col justify-center gap-3 rounded-xl border border-[#242424] border-l-2 border-l-[#FDD458] bg-[#141414] p-5">
        <div className="text-[11px] uppercase tracking-wide text-[#6E6E6E]">
          {data.research?.symbol ?? data.hero.symbol} · Narrative
        </div>
        <div className="text-sm leading-snug text-[#F5F5F5]">
          {data.research?.summary ??
            'Trend above SMA50 with RSI cooling from overbought…'}
        </div>
        <ConfidenceMeter value={conf} label="Confidence" />
      </div>
    );
  }

  return (
    <MarketWatchlist
      assets={data.watchlist.map((q) => ({
        symbol: q.symbol,
        name: q.name,
        price: q.priceNum,
        change: q.changePct,
        points: q.points,
      }))}
    />
  );
}

/** Full-width markets band — 21st Ticker cards with live quotes. */
function MarketsBand({ markets }: { markets: MarketingQuote[] }) {
  const router = useRouter();
  const items = markets.length ? markets : [];

  return (
    <div className="mx-auto grid w-full max-w-[1400px] grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
      {items.map((m) => (
        <Ticker
          key={m.symbol}
          onClick={() =>
            router.push(`/sign-in?callbackUrl=${encodeURIComponent(`/stocks/${m.symbol}`)}`)
          }
          className="flex min-h-[120px] w-full flex-col items-start justify-between gap-2 rounded-xl border border-[#242424] bg-[#141414] p-3.5 text-left transition hover:border-[#FDD458]/40"
        >
          <div className="flex w-full items-center gap-2">
            <TickerIcon symbol={m.symbol} className="size-8" />
            <div className="min-w-0">
              <TickerSymbol symbol={m.symbol} />
              <div className="truncate text-[10px] text-[#6E6E6E]">{m.name}</div>
            </div>
          </div>
          <div className="w-full">
            <TickerPrice price={m.priceNum} className="block text-[15px] text-[#F5F5F5]" />
            <TickerPriceChange change={m.changePct} isPercent className="mt-0.5" />
          </div>
          <svg viewBox="0 0 80 24" className="h-6 w-full" aria-hidden>
            <path
              d={m.points
                .map((v, i) => {
                  const max = Math.max(...m.points);
                  const min = Math.min(...m.points);
                  const x = (i / (m.points.length - 1 || 1)) * 80;
                  const y = 2 + (1 - (v - min) / (max - min || 1)) * 20;
                  return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
                })
                .join(' ')}
              fill="none"
              stroke={m.up ? '#22C55E' : '#EF4444'}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </Ticker>
      ))}
    </div>
  );
}

export default function MarketingLanding({ data }: { data: MarketingLiveData }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      <TickerMarquee items={data.tape} className="relative z-20" durationSec={22} />
      <MarketingHeader />

      <KineticGrid contained className="relative min-h-[78vh] border-b border-[#242424]">
        <div
          className="hero-glow animate-breathe pointer-events-none absolute -right-[10%] -top-[10%] z-[1] h-[900px] w-[900px]"
          aria-hidden
        />
        <section className="relative z-10 flex min-h-[78vh] items-center justify-center px-4 py-16 md:px-8 md:py-20 lg:px-10">
          <div className="flex w-full max-w-[1100px] flex-col items-center gap-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(253,212,88,0.4)] px-3 py-1.5">
              <span className="size-1.5 rounded-full bg-[#FDD458]" />
              <span className="text-xs font-medium tracking-wide text-[#F5F5F5]">
                Signals · Research · Alerts
              </span>
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-[-0.02em] text-[#F5F5F5] md:text-6xl">
              Trade{' '}
              <span className="bg-gradient-to-r from-[#FFE694] via-[#FDD458] to-[#F97316] bg-clip-text text-transparent">
                the signal
              </span>
              ,<br />
              not the noise.
            </h1>
            <p className="max-w-xl text-base leading-7 text-[#A1A1A1] md:text-lg">
              AI-powered market research, real-time charts, and paper trading — built for retail
              investors who want more than a broker app.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/sign-up"
                className="shiny-btn relative inline-flex items-center gap-2 overflow-hidden rounded-lg bg-gradient-to-br from-[#FDD458] to-[#F97316] px-5 py-3 text-sm font-semibold text-[#0A0A0A]"
              >
                <span className="relative z-10 inline-flex items-center gap-2">
                  Start free <ArrowRight className="size-4" />
                </span>
                <span aria-hidden className="shiny-btn-sheen pointer-events-none absolute inset-0" />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 rounded-lg border border-[#2E2E2E] px-5 py-3 text-sm font-medium text-[#F5F5F5] hover:border-[#FDD458] hover:text-[#FDD458]"
              >
                <Play className="size-3.5 fill-current" />
                See it live
              </Link>
            </div>
            <p className="text-xs text-[#6E6E6E]">Live data from Finnhub · Binance</p>
            <DrawlineSpark className="mt-2 h-[90px] w-full max-w-3xl" />
            <div className="mt-2 w-full">
              <ProductPreview data={data} />
            </div>
          </div>
        </section>
      </KineticGrid>

      <section id="markets" className="w-full px-4 py-10 md:px-8 lg:px-10">
        <div className="mx-auto mb-5 flex max-w-[1400px] items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#F5F5F5]">Markets</h2>
            <p className="text-sm text-[#6E6E6E]">Live quotes across equities & crypto</p>
          </div>
          <Link href="/sign-in" className="text-[13px] text-[#FDD458] hover:underline">
            Trade live →
          </Link>
        </div>
        <MarketsBand markets={data.markets} />
      </section>

      <section
        id="product"
        className="flex w-full flex-col gap-16 px-4 py-16 md:gap-20 md:px-8 md:py-20 lg:px-10"
      >
        {FEATURES.map((f) => (
          <div
            key={f.title}
            id={f.visual === 'research' ? 'research' : undefined}
            className={cn(
              'mx-auto flex w-full max-w-[1200px] flex-col items-stretch gap-10 md:flex-row md:gap-14',
              f.reverse && 'md:flex-row-reverse'
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-3.5">
              <h2 className="text-[22px] font-semibold text-[#F5F5F5] md:text-[26px]">{f.title}</h2>
              <p className="max-w-xl text-sm leading-[21px] text-[#A1A1A1] md:text-[15px] md:leading-6">
                {f.body}
              </p>
              <ul className="mt-1 flex flex-col gap-2">
                {f.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2 text-[13px] text-[#F5F5F5]">
                    <Check className="size-3.5 text-[#FDD458]" strokeWidth={2.5} />
                    {b}
                  </li>
                ))}
              </ul>
              <Link
                href={f.href}
                className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-[#FDD458] hover:underline"
              >
                Learn more <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="relative min-w-0 flex-1">
              <FeatureVisual kind={f.visual} data={data} />
            </div>
          </div>
        ))}
      </section>

      <section className="bg-[#141414] px-4 py-16 md:px-8 lg:px-10">
        <h2 className="mb-6 text-center text-xl font-semibold text-[#F5F5F5]">
          Trusted by prosumer traders
        </h2>
        <div className="mx-auto grid max-w-[1200px] gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.author} className="animate-test rounded-xl border border-[#242424] bg-[#0A0A0A] p-5">
              <div className="mb-2.5 flex gap-0.5 text-[#FDD458]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.3L12 17.8l-6.4 3.9 1.7-7.3-5.6-4.9 7.4-.6z" />
                  </svg>
                ))}
              </div>
              <p className="mb-3 text-[13px] leading-[19px] text-[#F5F5F5]">{t.quote}</p>
              <p className="text-xs text-[#6E6E6E]">{t.author}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="cta" className="relative overflow-hidden px-4 py-20 text-center md:px-8 lg:px-10">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(249,115,22,0.18),transparent_65%)]"
          aria-hidden
        />
        <h2 className="relative text-3xl font-semibold tracking-[-0.02em] text-[#F5F5F5]">
          Ready to trade the signal?
        </h2>
        <p className="relative mx-auto mt-3 max-w-md text-[15px] text-[#A1A1A1]">
          Free to start. No credit card required.
        </p>
        <Link
          href="/sign-up"
          className="relative mt-5 inline-flex rounded-lg bg-gradient-to-br from-[#FDD458] to-[#F97316] px-5 py-3 text-sm font-semibold text-[#0A0A0A]"
        >
          Start free
        </Link>
      </section>

      <footer className="border-t border-[#242424] px-4 py-10 md:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1200px] gap-8 md:grid-cols-4">
          <div>
            <BrandLogo href="/" />
            <p className="mt-2 text-xs text-[#6E6E6E]">Trade the signal, not the noise.</p>
          </div>
          {[
            {
              title: 'Product',
              links: [
                { label: 'Sign in', href: '/sign-in' },
                { label: 'Create account', href: '/sign-up' },
                { label: 'Dashboard', href: '/dashboard' },
              ],
            },
            {
              title: 'App',
              links: [
                { label: 'Watchlist', href: '/watchlist' },
                { label: 'Portfolio', href: '/portfolio' },
                { label: 'Research', href: '/research' },
              ],
            },
            {
              title: 'Developers',
              links: [
                { label: 'API keys', href: '/developers' },
                { label: 'Settings', href: '/settings' },
              ],
            },
          ].map((col) => (
            <div key={col.title}>
              <div className="mb-2.5 text-xs uppercase tracking-wide text-[#6E6E6E]">{col.title}</div>
              <div className="flex flex-col gap-2">
                {col.links.map((l) => (
                  <Link key={l.href} href={l.href} className="text-[13px] text-[#A1A1A1] hover:text-[#FDD458]">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-[1200px] text-[11px] text-[#6E6E6E]">
          © {new Date().getFullYear()} Signalist. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
