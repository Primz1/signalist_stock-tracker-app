import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { getCachedSession } from '@/lib/auth/session';
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
import { PageEnter } from '@/components/ui/motion';
import { getEconomicCalendarEvents } from '@/lib/actions/economic.actions';
import { EconomicCalendar } from '@/components/ui/economic-calendar';
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

const scriptUrl = 'https://s3.tradingview.com/external-embedding/embed-widget-';

export default async function Home() {
  const session = await getCachedSession();
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
  const [scores, reports, ecoEvents] = await Promise.all([
    symbols.length
      ? StockScoreModel.find({ symbol: { $in: symbols } }).select('symbol score').lean()
      : Promise.resolve([]),
    AiReportModel.find()
      .sort({ createdAt: -1 })
      .limit(3)
      .select('symbol summary confidence createdAt')
      .lean(),
    getEconomicCalendarEvents(),
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

  const cash = Number(portfolio?.cash ?? 10000);
  const totalValue = Number(portfolio?.totalValue ?? 0) || cash;
  const plTotal = Number(portfolio?.plTotal ?? 0);
  const plPercent = Number(portfolio?.plPercent ?? 0);
  const dayPl = Number((portfolio as { dayPl?: number } | null)?.dayPl ?? 0);
  const dayPlPercent = Number((portfolio as { dayPlPercent?: number } | null)?.dayPlPercent ?? 0);
  const holdingsCount = (portfolio?.holdings as unknown[] | undefined)?.length ?? 0;

  const heroHolding = (portfolio?.holdings as { symbol: string; price?: number }[] | undefined)?.[0];
  const heroSym = (heroHolding?.symbol || watchlist[0]?.symbol || 'NVDA').toUpperCase();

  const typedReports = reports as {
    _id?: { toString(): string };
    symbol: string;
    query?: string;
    summary?: string;
    confidence?: number;
    createdAt?: string | Date;
  }[];

  return (
    <PageEnter className="flex flex-col">
      <TickerTape items={tapeItems} />

      <div className="flex flex-col gap-12">
        {/* Account: the one number that matters, then what moved it */}
        <section
          aria-labelledby="account-heading"
          className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12"
        >
          <div className="flex flex-col">
            <p className="text-[15px] text-ink-2">
              {greeting()}, {firstName}
            </p>
            <h1 id="account-heading" className="mt-5 label-sm">
              Paper portfolio value
            </h1>
            <div className="figure mt-1 text-[44px] leading-none text-ink md:text-[56px]">
              {formatPrice(totalValue)}
            </div>
            <div className="mono mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[14px]">
              <span className={dayPl > 0 ? 'text-up' : dayPl < 0 ? 'text-down' : 'text-ink-2'}>
                {signed(dayPl)} ({signedPct(dayPlPercent)}) today
              </span>
              <span className={plTotal > 0 ? 'text-up' : plTotal < 0 ? 'text-down' : 'text-ink-2'}>
                {signed(plTotal)} ({signedPct(plPercent)}) all time
              </span>
            </div>

            <dl className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
              {[
                { k: 'Cash', v: formatPrice(cash) },
                { k: 'Invested', v: formatPrice(Math.max(0, totalValue - cash)) },
                { k: 'Positions', v: String(holdingsCount) },
              ].map((s) => (
                <div key={s.k} className="bg-canvas px-4 py-3">
                  <dt className="label-sm">{s.k}</dt>
                  <dd className="mono mt-1 truncate text-[15px] text-ink">{s.v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex flex-wrap gap-2">
              <SearchCommand
                renderAs="button"
                label="Add symbol"
                initialStocks={initialStocks}
                quickAddEnabled
                pill
                className="!w-auto !max-w-none !justify-center !border-transparent !bg-signal !px-4 !font-semibold !text-signal-ink hover:!bg-signal-hover"
              />
              <Link href="/watchlist" className="ghost-btn">
                New alert
              </Link>
              <Link href="/research" className="ghost-btn">
                Run research
              </Link>
            </div>
          </div>

          <div className="surface-card flex min-h-[280px] flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="mono text-[14px] font-medium text-ink">{heroSym}</span>
                <span className="truncate text-[13px] text-ink-3">
                  {heroHolding ? 'Largest position' : 'From your watchlist'} · 1 month
                </span>
              </div>
              <Link
                href={`/stocks/${heroSym}`}
                className="flex-none text-[13px] font-medium text-signal hover:underline"
              >
                Open chart
              </Link>
            </div>
            <div className="flex-1 px-2 pb-2">
              <TradingViewWidget
                scriptUrl={`${scriptUrl}mini-symbol-overview.js`}
                config={MINI_CHART_WIDGET_CONFIG(heroSym)}
                height={230}
              />
            </div>
          </div>
        </section>

        {/* What to look at next: watchlist movers and the latest research */}
        <section className="grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="section-title">Your watchlist</h2>
              <Link href="/watchlist" className="text-[13px] text-ink-2 hover:text-ink">
                Open watchlist
              </Link>
            </div>
            <div className="surface-card overflow-x-auto">
              <table className="w-full min-w-[480px] text-[14px]">
                <thead>
                  <tr className="border-b border-line text-left">
                    {['Symbol', 'Price', 'Today', 'AI score'].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className={`px-4 py-2.5 text-[12px] font-medium text-ink-3 ${h !== 'Symbol' ? 'text-right' : ''}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {watchlist.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8">
                        <p className="text-[14px] text-ink">No symbols yet.</p>
                        <p className="mt-1 text-[13px] text-ink-3">
                          Add a ticker with Add symbol and its price, move and AI score show up
                          here.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    watchlist.slice(0, 6).map((row) => {
                      const sym = row.symbol.toUpperCase();
                      const q = quoteMap.get(sym);
                      const ch = q?.change ?? 0;
                      return (
                        <tr key={sym} className="border-b border-line last:border-0 hover:bg-surface-2">
                          <td className="px-4 py-3">
                            <Link href={`/stocks/${sym}`} className="flex min-w-0 items-baseline gap-2.5">
                              <span className="mono font-medium text-ink">{sym}</span>
                              <span className="truncate text-[13px] text-ink-3">{row.company}</span>
                            </Link>
                          </td>
                          <td className="mono px-4 py-3 text-right text-ink">
                            {q?.price != null ? formatPrice(q.price) : '—'}
                          </td>
                          <td className={`mono px-4 py-3 text-right ${ch >= 0 ? 'text-up' : 'text-down'}`}>
                            {q?.change != null ? signedPct(ch) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <ScoreCell score={scoreMap.get(sym)} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="section-title">Latest research</h2>
              <Link href="/research" className="text-[13px] text-ink-2 hover:text-ink">
                New report
              </Link>
            </div>
            <div className="surface-card divide-y divide-line">
              {typedReports.length === 0 ? (
                <Link href="/research" className="block px-4 py-5 hover:bg-surface-2">
                  <div className="flex items-center gap-2 text-[14px] text-ink">
                    <Sparkles className="size-4 text-signal" strokeWidth={1.5} />
                    No reports yet
                  </div>
                  <p className="mt-1 text-[13px] leading-5 text-ink-3">
                    Pick a symbol: Signalist computes the factors first, then writes a narrative
                    that only cites those numbers.
                  </p>
                </Link>
              ) : (
                typedReports.map((r, i) => {
                  const conf = Math.round((r.confidence ?? 0.7) * 100);
                  const key =
                    (r._id && String(r._id)) ||
                    `${r.symbol}-${r.createdAt ? new Date(r.createdAt).getTime() : i}-${i}`;
                  return (
                    <Link
                      key={key}
                      href={`/research?symbol=${r.symbol}`}
                      className="block px-4 py-3.5 hover:bg-surface-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="mono text-[13px] font-medium text-ink">{r.symbol}</span>
                        <span className="mono text-[12px] text-ink-3">{conf}% confidence</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-ink-2">
                        {r.query || r.summary || 'Research report'}
                      </p>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section>
          <EconomicCalendar events={ecoEvents} title="Economic calendar" seeAllHref="/research" />
        </section>

        {/* Markets: TradingView embeds */}
        <section aria-labelledby="markets-heading">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="markets-heading" className="section-title">
              Markets
            </h2>
            <span className="text-[13px] text-ink-3">Delayed data via TradingView</span>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="surface-card min-h-[420px] p-2 xl:col-span-1">
              <TradingViewWidget
                scriptUrl={`${scriptUrl}market-overview.js`}
                config={MARKET_OVERVIEW_WIDGET_CONFIG}
                height={400}
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
      </div>
    </PageEnter>
  );
}

function signed(n: number) {
  return `${n >= 0 ? '+' : '−'}${formatPrice(Math.abs(n))}`;
}

function signedPct(n: number) {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}%`;
}

function ScoreCell({ score }: { score?: number }) {
  if (score == null) return <span className="mono text-ink-3">—</span>;
  const tone = score >= 65 ? 'text-up' : score >= 45 ? 'text-ink' : 'text-down';
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="hidden h-1 w-12 overflow-hidden rounded-full bg-surface-3 sm:block" aria-hidden>
        <span className="block h-full rounded-full bg-signal" style={{ width: `${score}%` }} />
      </span>
      <span className={`mono ${tone}`}>{Math.round(score)}</span>
    </span>
  );
}
