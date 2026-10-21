/**
 * BACKUP — TradingView widget dashboard (pre–Command Center).
 *
 * To restore this version as the home page:
 *   Copy this file’s contents into `app/(root)/page.tsx`
 *   (or tell the agent: “revert dashboard to TradingView backup”)
 *
 * Do not import this file as a route.
 */
import Link from 'next/link';
import { headers } from 'next/headers';
import { Sparkles } from 'lucide-react';
import { auth } from '@/lib/better-auth/auth';
import { getPortfolio } from '@/lib/actions/portfolio.actions';
import { listWatchlist } from '@/lib/actions/watchlist.actions';
import { fetchJSON, searchStocks } from '@/lib/actions/finnhub.actions';
import { connectToDatabase } from '@/database/mongoose';
import { StockScoreModel } from '@/database/models/stockScore.model';
import { AiReportModel } from '@/database/models/aiReport.model';
import { formatPrice } from '@/lib/utils';
import TickerTape from '@/components/dashboard/TickerTape';
import { SearchCommand } from '@/components/search/SearchCommand';
import TradingViewWidget from '@/components/market/TradingViewWidget';
import {
  HEATMAP_WIDGET_CONFIG,
  MARKET_DATA_WIDGET_CONFIG,
  MARKET_OVERVIEW_WIDGET_CONFIG,
  MINI_CHART_WIDGET_CONFIG,
  TOP_STORIES_WIDGET_CONFIG,
} from '@/lib/constants';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const token = () => process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? '';

const TAPE_SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'META', 'GOOGL', 'AMD'];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const scoreStyle = (score?: number) => {
  if (score == null) return { bg: 'rgba(110,110,110,0.12)', color: '#6E6E6E', label: '—' };
  if (score >= 65) return { bg: 'rgba(34,197,94,0.12)', color: '#22C55E', label: `${score}/100` };
  if (score >= 45) return { bg: 'rgba(253,212,88,0.12)', color: '#FDD458', label: `${score}/100` };
  return { bg: 'rgba(239,68,68,0.12)', color: '#EF4444', label: `${score}/100` };
};

const scriptUrl = 'https://s3.tradingview.com/external-embedding/embed-widget-';

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  const firstName = session?.user?.name?.split(/\s+/)[0] || 'Trader';

  const [portfolioRes, watchlistRes, initialStocks] = await Promise.all([
    getPortfolio(),
    listWatchlist(),
    searchStocks(),
  ]);

  const portfolio = portfolioRes.success ? portfolioRes.data : null;
  const watchlist = watchlistRes.success
    ? watchlistRes.data.map((w) => ({
        symbol: String(w.symbol),
        company: String(w.company),
      }))
    : [];

  await connectToDatabase();
  const symbols = watchlist.map((w) => w.symbol.toUpperCase()).slice(0, 6);
  const [scores, reports] = await Promise.all([
    symbols.length
      ? StockScoreModel.find({ symbol: { $in: symbols } }).lean()
      : Promise.resolve([]),
    AiReportModel.find().sort({ createdAt: -1 }).limit(3).lean(),
  ]);

  const scoreMap = new Map(
    (scores as { symbol: string; score: number }[]).map((s) => [s.symbol.toUpperCase(), s.score])
  );

  const quoteSymbols = Array.from(
    new Set([...TAPE_SYMBOLS, ...symbols, 'NVDA'].map((s) => s.toUpperCase()))
  );

  const quotes = await Promise.all(
    quoteSymbols.map(async (sym) => {
      try {
        const q = await fetchJSON<{ c?: number; dp?: number }>(
          `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(sym)}&token=${token()}`
        );
        return { symbol: sym, price: q?.c, change: q?.dp };
      } catch {
        return { symbol: sym, price: undefined, change: undefined };
      }
    })
  );
  const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

  const tapeItems = quotes
    .filter((q) => q.price != null)
    .slice(0, 8)
    .map((q) => ({
      symbol: q.symbol,
      price: formatPrice(q.price!),
      change: `${(q.change ?? 0) >= 0 ? '+' : ''}${(q.change ?? 0).toFixed(2)}%`,
      up: (q.change ?? 0) >= 0,
    }));

  const totalValue = Number(portfolio?.totalValue ?? 0);
  const plTotal = Number(portfolio?.plTotal ?? 0);
  const plPercent = Number(portfolio?.plPercent ?? 0);
  const plUp = plTotal >= 0;

  const heroHolding = (portfolio?.holdings as { symbol: string; price?: number }[] | undefined)?.[0];
  const heroSym = heroHolding?.symbol || watchlist[0]?.symbol || 'NVDA';

  return (
    <div className="flex flex-col">
      <TickerTape items={tapeItems} />

      <div className="flex flex-col gap-8">
        {/* Hero */}
        <div className="relative flex flex-col gap-6 overflow-hidden rounded-2xl border border-signal/30 bg-surface p-5 shadow-[0_0_60px_-25px_rgba(249,115,22,0.35)] md:flex-row md:p-8">
          <div
            className="pointer-events-none absolute -left-[10%] -top-[30%] h-[520px] w-[520px]"
            style={{
              background:
                'radial-gradient(circle,rgba(249,115,22,0.2) 0%,rgba(124,45,18,0.06) 45%,transparent 70%)',
              animation: 'breathe 8s ease-in-out infinite',
            }}
          />
          <div className="relative flex flex-1 flex-col justify-center gap-3">
            <div className="text-xl font-semibold text-ink">
              {greeting()}, {firstName}
            </div>
            <div className="mono text-[32px] font-medium text-ink">
              {formatPrice(totalValue || Number(portfolio?.cash ?? 10000))}
            </div>
            <div
              className={`mono w-fit rounded-full px-2.5 py-0.5 text-[13px] ${
                plUp
                  ? 'bg-up/12 text-up'
                  : 'bg-down/12 text-down'
              }`}
            >
              {plUp ? '+' : ''}
              {formatPrice(plTotal)} ({plUp ? '+' : ''}
              {plPercent.toFixed(2)}%) today
            </div>
            <div className="mt-1 flex max-w-md items-start gap-1.5 text-[13px] text-ink-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none text-signal" strokeWidth={1.5} />
              Paper portfolio snapshot. Add symbols, set alerts, or run AI research to sharpen your edge.
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <SearchCommand
                renderAs="button"
                label="+ Add symbol"
                initialStocks={initialStocks}
                quickAddEnabled
                pill
                className="!h-auto !w-auto rounded-full border border-line-strong bg-transparent px-3 py-1.5 text-xs font-normal text-ink hover:border-signal hover:bg-transparent hover:text-signal"
              />
              <Link
                href="/watchlist"
                className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-ink hover:border-signal hover:text-signal"
              >
                + New alert
              </Link>
              <Link
                href="/research"
                className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-ink hover:border-signal hover:text-signal"
              >
                Run research
              </Link>
            </div>
          </div>
          <div className="relative min-h-[240px] flex-1 overflow-hidden rounded-xl bg-canvas">
            <div className="flex items-center justify-between px-3 pt-2.5">
              <span className="mono text-xs text-ink-2">{heroSym.toUpperCase()}</span>
              <Link
                href={`/stocks/${heroSym.toUpperCase()}`}
                className="text-[11px] text-signal hover:underline"
              >
                Open chart →
              </Link>
            </div>
            <TradingViewWidget
              scriptUrl={`${scriptUrl}mini-symbol-overview.js`}
              config={MINI_CHART_WIDGET_CONFIG(heroSym)}
              height={220}
            />
          </div>
        </div>

        {/* Markets — real TradingView widgets */}
        <section>
          <div className="mb-4 flex items-baseline gap-2.5">
            <h2 className="section-title">Markets</h2>
            <span className="text-xs font-medium uppercase tracking-wide text-ink-3">
              Live snapshot
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="surface-card min-h-[420px] p-2 xl:col-span-1">
              <TradingViewWidget
                scriptUrl={`${scriptUrl}market-overview.js`}
                config={MARKET_OVERVIEW_WIDGET_CONFIG}
                height={400}
                className="custom-chart"
              />
            </div>
            <div className="surface-card min-h-[420px] p-2 xl:col-span-2">
              <TradingViewWidget
                scriptUrl={`${scriptUrl}stock-heatmap.js`}
                config={HEATMAP_WIDGET_CONFIG}
                height={400}
              />
            </div>
            <div className="surface-card min-h-[420px] p-2 xl:col-span-1">
              <TradingViewWidget
                scriptUrl={`${scriptUrl}timeline.js`}
                config={TOP_STORIES_WIDGET_CONFIG}
                height={400}
                className="custom-chart"
              />
            </div>
            <div className="surface-card min-h-[420px] p-2 xl:col-span-2">
              <TradingViewWidget
                scriptUrl={`${scriptUrl}market-quotes.js`}
                config={MARKET_DATA_WIDGET_CONFIG}
                height={400}
              />
            </div>
          </div>
        </section>

        {/* Watchlist preview */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">Your watchlist</h2>
            <Link href="/watchlist" className="text-[13px] text-ink-2 hover:text-signal">
              View all
            </Link>
          </div>
          <div className="surface-card overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-[1fr_100px_100px_100px] border-b border-line px-4 py-2.5">
                {['Symbol', 'Price', 'Change', 'AI Score'].map((h) => (
                  <div
                    key={h}
                    className={`text-xs uppercase tracking-wide text-ink-3 ${h !== 'Symbol' ? 'text-right' : ''}`}
                  >
                    {h}
                  </div>
                ))}
              </div>
              {watchlist.length === 0 ? (
                <div className="px-4 py-8 text-center text-[13px] text-ink-3">
                  No symbols yet.{' '}
                  <Link href="/watchlist" className="text-signal">
                    Add to watchlist
                  </Link>
                </div>
              ) : (
                watchlist.slice(0, 5).map((row) => {
                  const sym = row.symbol.toUpperCase();
                  const q = quoteMap.get(sym);
                  const up = (q?.change ?? 0) >= 0;
                  const sc = scoreStyle(scoreMap.get(sym));
                  const initials = sym.slice(0, 2);
                  return (
                    <Link
                      key={sym}
                      href={`/stocks/${sym}`}
                      className="grid grid-cols-[1fr_100px_100px_100px] items-center border-b border-surface-2 px-4 py-3 last:border-0 hover:bg-surface-2/40"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="mono flex h-[26px] w-[26px] items-center justify-center rounded-full bg-signal/12 text-[10px] font-semibold text-ink">
                          {initials}
                        </div>
                        <span className="mono text-[13px] text-ink">{sym}</span>
                      </div>
                      <div className="mono text-right text-[13px] text-ink">
                        {q?.price != null ? formatPrice(q.price) : '—'}
                      </div>
                      <div
                        className={`mono text-right text-[13px] ${up ? 'text-up' : 'text-down'}`}
                      >
                        {(q?.change ?? 0) >= 0 ? '+' : ''}
                        {(q?.change ?? 0).toFixed(2)}%
                      </div>
                      <div className="text-right">
                        <span
                          className="mono rounded-full px-2 py-0.5 text-xs"
                          style={{ background: sc.bg, color: sc.color }}
                        >
                          {sc.label}
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Research */}
        <section className="pb-10">
          <h2 className="section-title mb-4">Latest research</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {(reports as { symbol: string; query?: string; summary?: string; confidence?: number }[])
              .length === 0 ? (
              <Link
                href="/research"
                className="rounded-xl border border-line border-l-2 border-l-signal bg-surface p-4 md:col-span-3"
              >
                <div className="mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-signal" strokeWidth={1.5} />
                  <span className="text-[11px] uppercase tracking-wide text-ink-3">AI</span>
                </div>
                <p className="text-[13px] text-ink">
                  No research yet. Run your first AI report on any symbol.
                </p>
              </Link>
            ) : (
              (
                reports as {
                  symbol: string;
                  query?: string;
                  summary?: string;
                  confidence?: number;
                }[]
              ).map((r) => {
                const conf = Math.round((r.confidence ?? 0.7) * 100);
                return (
                  <Link
                    key={`${r.symbol}-${r.query}`}
                    href={`/research?symbol=${r.symbol}`}
                    className="rounded-xl border border-line border-l-2 border-l-signal bg-surface p-4"
                  >
                    <div className="mb-2.5 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-signal" strokeWidth={1.5} />
                      <span className="text-[11px] uppercase tracking-wide text-ink-3">
                        {r.symbol}
                      </span>
                    </div>
                    <p className="mb-2.5 line-clamp-2 text-[13px] text-ink">
                      {r.query || r.summary || 'Research report'}
                    </p>
                    <div className="mb-2 h-1 overflow-hidden rounded-sm bg-surface-2">
                      <div className="h-full bg-signal" style={{ width: `${conf}%` }} />
                    </div>
                    <div className="text-xs text-ink-3">{conf}% confidence</div>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
