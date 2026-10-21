'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import BrandLogo from '@/components/layout/BrandLogo';
import { MarketingSearch } from '@/components/marketing/MarketingSearch';
import { AlertLevelChart } from '@/components/marketing/AlertLevelChart';
import { cn } from '@/lib/utils';
import type { MarketingLiveData, MarketingQuote } from '@/lib/marketing/live-data';

/**
 * Landing: "the alert level" is the motif. The hero chart lets visitors drag a level over
 * real candles; every later section is about what happens at a level you chose.
 */

const NAV = [
  { href: '#alerts', label: 'Alerts' },
  { href: '#research', label: 'Research' },
  { href: '#paper', label: 'Paper trading' },
  { href: '#api', label: 'API' },
];

/** Reveal sections below the fold once. Nothing is hidden unless this script runs. */
function useRevealOnScroll() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const below = els.filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.9);
    if (!('IntersectionObserver' in window) || below.length === 0) return;
    below.forEach((el) => el.classList.add('reveal-pending'));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.remove('reveal-pending');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -12% 0px' }
    );
    below.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function Header() {
  return (
    <header className="mx-auto flex h-16 w-full max-w-[1320px] items-center gap-8 px-4 md:px-8">
      <BrandLogo href="/" />
      <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
        {NAV.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="rounded-md px-3 py-1.5 text-[14px] text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            {l.label}
          </a>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <MarketingSearch className="hidden sm:flex" />
        <Link
          href="/sign-in"
          className="press rounded-lg px-3 py-2 text-[14px] text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          Sign in
        </Link>
        <Link href="/sign-up" className="yellow-btn h-9 px-4 text-[14px]">
          Create account
        </Link>
      </div>
    </header>
  );
}

function Hero({ data }: { data: MarketingLiveData }) {
  return (
    <section className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-14 md:px-8 md:pb-40 md:pt-24">
      <h1 className="animate-el max-w-[14ch] text-[clamp(2.5rem,8.4vw,7.75rem)] font-semibold leading-[0.92] tracking-[-0.045em] text-ink">
        Trade the signal, not the noise.
      </h1>
      <div
        className="animate-el mt-8 flex flex-col gap-8 md:mt-10 md:flex-row md:items-end md:justify-between"
        style={{ animationDelay: '70ms' }}
      >
        <p className="max-w-[46ch] text-[18px] leading-[1.55] text-ink-2 md:text-[20px]">
          Signalist watches the price levels you set on stocks and crypto, tells you the moment one
          is crossed, and backs every AI note with the numbers behind it.
        </p>
        <div className="flex flex-none items-center gap-3">
          <Link href="/sign-up" className="yellow-btn h-12 px-6 text-[15px]">
            Create free account <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/sign-in"
            className="press rounded-lg px-4 py-3 text-[15px] text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            Sign in
          </Link>
        </div>
      </div>

      <div className="animate-el mt-20 md:mt-28" style={{ animationDelay: '140ms' }}>
        {data.heroCandles.length > 20 ? (
          <AlertLevelChart symbol={data.hero.symbol} candles={data.heroCandles} />
        ) : (
          <QuoteBoard quotes={data.markets} columns={2} />
        )}
      </div>
    </section>
  );
}

function pct(n: number) {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}%`;
}

function QuoteBoard({ quotes, columns = 1 }: { quotes: MarketingQuote[]; columns?: 1 | 2 }) {
  return (
    <ul className={cn('grid gap-x-16', columns === 2 && 'lg:grid-cols-2')}>
      {quotes.map((q, i) => (
        <li
          key={q.symbol}
          data-reveal
          style={{ '--i': i } as React.CSSProperties}
          className="flex items-baseline gap-4 py-4 odd:bg-canvas/40 sm:px-4"
        >
          <span className="mono w-16 flex-none text-[20px] font-medium text-ink md:w-20 md:text-[26px]">
            {q.symbol}
          </span>
          <span className="hidden min-w-0 flex-1 truncate text-[15px] text-ink-3 sm:block">{q.name}</span>
          <span className="mono ml-auto text-[20px] text-ink md:text-[26px]">{q.price}</span>
          <span className={cn('mono w-20 flex-none text-right text-[15px]', q.up ? 'text-up' : 'text-down')}>
            {pct(q.changePct)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Markets({ data }: { data: MarketingLiveData }) {
  return (
    <section className="bg-surface">
      <div className="mx-auto grid w-full max-w-[1320px] gap-12 px-4 py-24 md:px-8 md:py-32 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-20">
        <div data-reveal>
          <h2 className="max-w-[13ch] text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink">
            Live quotes, not screenshots.
          </h2>
          <p className="mt-5 max-w-[36ch] text-[17px] leading-[1.55] text-ink-2">
            These came from Finnhub and Binance when this page loaded. Equities and crypto sit in
            the same list, priced the same way.
          </p>
        </div>
        <QuoteBoard quotes={data.markets} />
      </div>
    </section>
  );
}

function Alerts({ data }: { data: MarketingLiveData }) {
  const price = data.hero.priceNum;
  const step = price >= 200 ? 5 : 1;
  const level = Math.ceil((price * 1.05) / step) * step;
  const away = ((level - price) / price) * 100;
  const rows: [string, string][] = [
    ['Condition', 'Price above'],
    ['Level', level.toLocaleString('en-US', { minimumFractionDigits: 2 })],
    ['Frequency', 'Once'],
    ['Now', `${data.hero.price}  (${away.toFixed(1)}% below)`],
  ];
  return (
    <section id="alerts" className="mx-auto w-full max-w-[1320px] scroll-mt-8 px-4 py-28 md:px-8 md:py-44">
      <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-24">
        <div data-reveal>
          <h2 className="text-[clamp(2rem,4.4vw,4rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink">
            Your levels, watched for you.
          </h2>
          <p className="mt-6 max-w-[44ch] text-[18px] leading-[1.55] text-ink-2">
            Set an upper or lower price on any symbol, once or on repeat. A background price poller
            checks it, so the alert fires whether or not Signalist is open, and lands in your alert
            inbox.
          </p>
          <Link
            href="/sign-up"
            className="mt-8 inline-flex items-center gap-2 text-[15px] font-medium text-signal underline-offset-4 hover:underline"
          >
            Set your first alert <ArrowRight className="size-4" />
          </Link>
        </div>

        {/* The printed thing of this world: an alert slip, filled from the live quote */}
        <div data-reveal style={{ '--i': 1 } as React.CSSProperties} className="mx-auto w-full max-w-[460px]">
          <div className="rounded-t-xl bg-signal px-7 pb-6 pt-7 text-signal-ink">
            <div className="text-[14px] font-medium opacity-75">Price alert</div>
            <div className="mt-2 flex items-baseline justify-between gap-4">
              <span className="mono text-[44px] font-semibold leading-none tracking-[-0.03em]">
                {data.hero.symbol}
              </span>
              <span className="text-[15px] font-medium">NVIDIA</span>
            </div>
          </div>
          <dl className="rounded-b-xl bg-surface-2 px-7 py-3">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-[15px] text-ink-3">{k}</dt>
                <dd className="mono whitespace-pre text-[16px] text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-center text-[13px] text-ink-3">
            Built from the live {data.hero.symbol} quote.
          </p>
        </div>
      </div>
    </section>
  );
}

function Research({ data }: { data: MarketingLiveData }) {
  const r = data.research;
  if (!r) return null;
  return (
    <section id="research" className="mx-auto w-full max-w-[1320px] scroll-mt-8 px-4 pb-28 md:px-8 md:pb-44">
      <h2
        data-reveal
        className="max-w-[18ch] text-[clamp(2rem,4.4vw,4rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink"
      >
        Numbers first. Words second.
      </h2>
      <p data-reveal className="mt-6 max-w-[56ch] text-[18px] leading-[1.55] text-ink-2">
        Signalist computes the factors in Python (trend, RSI, MACD, momentum, risk), then the
        narrative is written only from those figures, with a confidence score you can weigh.
      </p>

      <div className="mt-16 grid gap-10 md:mt-20 md:grid-cols-[auto_minmax(0,1fr)] md:gap-16">
        <div data-reveal>
          <div className="mono text-[clamp(5rem,14vw,11rem)] font-medium leading-[0.85] tracking-[-0.05em] text-signal">
            {r.confidence}%
          </div>
          <div className="mt-3 text-[15px] text-ink-2">confidence on {r.symbol}</div>
        </div>
        <blockquote data-reveal style={{ '--i': 1 } as React.CSSProperties} className="self-end">
          <p className="max-w-[30ch] text-[clamp(1.5rem,2.6vw,2.25rem)] leading-[1.25] tracking-[-0.015em] text-ink">
            “{r.summary}”
          </p>
          <footer className="mt-5 text-[14px] text-ink-3">
            {r.isSample
              ? 'Example narrative. Your reports are generated per symbol when you ask.'
              : `Latest report generated on Signalist for ${r.symbol}.`}
          </footer>
        </blockquote>
      </div>
    </section>
  );
}

const PAPER_FACTS = [
  { big: '$10,000', small: 'of paper cash to start' },
  { big: 'Live', small: 'fills at the current quote' },
  { big: '5 min', small: 'to undo any trade' },
  { big: 'CSV', small: 'export of realized P/L' },
];

function Paper() {
  return (
    <section id="paper" className="scroll-mt-8 bg-signal text-signal-ink">
      <div className="mx-auto w-full max-w-[1320px] px-4 py-24 md:px-8 md:py-32">
        <h2
          data-reveal
          className="max-w-[16ch] text-[clamp(2rem,4.4vw,4rem)] font-semibold leading-[1.02] tracking-[-0.035em]"
        >
          Practise on paper first.
        </h2>
        <p data-reveal className="mt-6 max-w-[48ch] text-[18px] leading-[1.55] opacity-80">
          Size a position, watch it against the market, and see your realized P/L, without a
          brokerage account anywhere in the loop.
        </p>
        <dl className="mt-16 grid grid-cols-2 gap-x-8 gap-y-12 md:mt-20 lg:grid-cols-4">
          {PAPER_FACTS.map((f, i) => (
            <div key={f.big} data-reveal style={{ '--i': i } as React.CSSProperties}>
              <dt className="text-[clamp(2.25rem,5vw,4.5rem)] font-semibold leading-none tracking-[-0.045em] tabular-nums">
                {f.big}
              </dt>
              <dd className="mt-3 text-[16px] opacity-80">{f.small}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Api({ data }: { data: MarketingLiveData }) {
  const sym = data.hero.symbol;
  return (
    <section id="api" className="mx-auto w-full max-w-[1320px] scroll-mt-8 px-4 py-28 md:px-8 md:py-44">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
        <div data-reveal>
          <h2 className="text-[clamp(2rem,4.4vw,4rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink">
            Your signals, over HTTP.
          </h2>
          <p className="mt-6 max-w-[40ch] text-[18px] leading-[1.55] text-ink-2">
            Create a key under API in the app and pull price, AI score, factors and indicators for
            any symbol into your own scripts.
          </p>
        </div>
        <pre
          data-reveal
          style={{ '--i': 1 } as React.CSSProperties}
          className="mono overflow-x-auto rounded-xl bg-surface p-6 text-[13px] leading-[1.75] text-ink-2 md:p-8 md:text-[14px]"
        >
          <code>
            <span className="text-ink-3">$ </span>
            <span className="text-ink">curl</span> https://signalist.app/api/v1/stocks/{sym} \{'\n'}
            {'    '}-H <span className="text-signal">&quot;x-api-key: sk_live_…&quot;</span>
            {'\n\n'}
            {'{\n'}
            {'  '}&quot;symbol&quot;: <span className="text-ink">&quot;{sym}&quot;</span>,{'\n'}
            {'  '}&quot;price&quot;: <span className="text-ink">{data.hero.priceNum}</span>,{'\n'}
            {'  '}&quot;changePercent&quot;: <span className="text-ink">{data.hero.changePct.toFixed(2)}</span>,{'\n'}
            {'  '}&quot;sentiment&quot;: …,{'\n'}
            {'  '}&quot;score&quot;: …,{'\n'}
            {'  '}&quot;factors&quot;: {'{ … }'},{'\n'}
            {'  '}&quot;indicators&quot;: {'{ … }'}
            {'\n}'}
          </code>
        </pre>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="mx-auto w-full max-w-[1320px] px-4 pb-28 md:px-8 md:pb-40">
      <div data-reveal className="flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
        <h2 className="max-w-[12ch] text-[clamp(2.5rem,7vw,6rem)] font-semibold leading-[0.95] tracking-[-0.045em] text-ink">
          Set your first level.
        </h2>
        <div className="flex flex-col items-start gap-3 md:items-end">
          <Link href="/sign-up" className="yellow-btn h-12 px-6 text-[15px]">
            Create free account <ArrowRight className="size-4" />
          </Link>
          <p className="text-[14px] text-ink-3">Paper money only. No brokerage connection.</p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const cols = [
    {
      title: 'Product',
      links: [
        { label: 'Alerts', href: '#alerts' },
        { label: 'Research', href: '#research' },
        { label: 'Paper trading', href: '#paper' },
        { label: 'API', href: '#api' },
      ],
    },
    {
      title: 'Account',
      links: [
        { label: 'Create account', href: '/sign-up' },
        { label: 'Sign in', href: '/sign-in' },
      ],
    },
  ];
  return (
    <footer className="bg-surface">
      <div className="mx-auto grid w-full max-w-[1320px] gap-10 px-4 py-14 md:grid-cols-[1.5fr_1fr_1fr] md:px-8">
        <div>
          <BrandLogo href="/" />
          <p className="mt-4 max-w-[40ch] text-[14px] leading-6 text-ink-3">
            Market data from Finnhub, Binance and TradingView, may be delayed. Nothing here is
            investment advice.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <div className="text-[14px] font-medium text-ink">{c.title}</div>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-[14px] text-ink-2 hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto w-full max-w-[1320px] px-4 pb-10 text-[13px] text-ink-3 md:px-8">
        © {new Date().getFullYear()} Signalist
      </div>
    </footer>
  );
}

export default function MarketingLanding({ data }: { data: MarketingLiveData }) {
  useRevealOnScroll();
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Header />
      <main>
        <Hero data={data} />
        <Markets data={data} />
        <Alerts data={data} />
        <Research data={data} />
        <Paper />
        <Api data={data} />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
