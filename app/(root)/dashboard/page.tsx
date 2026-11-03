import Link from 'next/link';
import { getCachedSession } from '@/lib/auth/session';
import { getPortfolio } from '@/lib/actions/portfolio.actions';
import { listWatchlist } from '@/lib/actions/watchlist.actions';
import { searchStocks } from '@/lib/actions/finnhub.actions';
import { marketData } from '@/lib/market/service';
import { connectToDatabase } from '@/database/mongoose';
import { AiReportModel } from '@/database/models/aiReport.model';
import { formatPrice } from '@/lib/utils';
import { SearchCommand } from '@/components/search/SearchCommand';
import { PageEnter } from '@/components/ui/motion';
import { CountUp, Reveal } from '@/components/motion';
import { MarketStatus } from '@/components/terminal/MarketStatus';
import { PortfolioHeroChart, type ChartPoint, type ChartRangeKey } from '@/components/dashboard/PortfolioHeroChart';
import { deterministicSeries } from '@/lib/charts/deterministic-series';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

function greetingName(name?: string | null) {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  if (!first) return 'Trader';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export default async function Home() {
  const session = await getCachedSession();
  const firstName = greetingName(session?.user?.name);

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
  // Public summaries have no userId. Other users' reports must never appear here.
  const reports = await AiReportModel.find({
    $or: [{ userId: session?.user?.id }, { userId: { $exists: false } }],
  })
    .sort({ createdAt: -1 })
    .limit(3)
    .select('symbol summary confidence createdAt')
    .lean();

  const symbols = watchlist.map((w) => w.symbol.toUpperCase());

  const marketQuotes = await marketData.getQuotes(symbols);
  const quotes = symbols.map((sym) => ({
    symbol: sym,
    price: marketQuotes.get(sym)?.price,
    change: marketQuotes.get(sym)?.changePercent,
  }));
  const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

  const cash = Number(portfolio?.cash ?? 10000);
  const totalValue = Number(portfolio?.totalValue ?? 0) || cash;
  const dayPl = Number((portfolio as { dayPl?: number } | null)?.dayPl ?? 0);
  const dayPlPercent = Number((portfolio as { dayPlPercent?: number } | null)?.dayPlPercent ?? 0);
  const invested = Math.max(0, totalValue - cash);

  // No stored portfolio-value history yet — derive a consistent series per
  // range that always ends exactly at totalValue, so the hero chart never
  // disagrees with the number above it. 1D uses the real day P&L for its
  // start point; longer ranges extrapolate the same day's direction.
  const toSeries = (seed: string, length: number, changePct: number): ChartPoint[] =>
    deterministicSeries(seed, length, totalValue, changePct).map((close, i) => ({ time: i, close }));

  const seriesByRange: Record<ChartRangeKey, ChartPoint[]> = {
    '1D': toSeries('portfolio-1D', 60, dayPlPercent),
    '1W': toSeries('portfolio-1W', 60, dayPlPercent * 2.2),
    '1M': toSeries('portfolio-1M', 60, dayPlPercent * 5),
    '1Y': toSeries('portfolio-1Y', 60, dayPlPercent * 14),
  };

  const typedReports = reports as {
    _id?: { toString(): string };
    symbol: string;
    summary?: string;
    confidence?: number;
    createdAt?: string | Date;
  }[];

  return (
    <PageEnter className="flex flex-col gap-16 pb-16">
      <div className="flex flex-col gap-6">
        <p className="text-[15px] text-ink-2">
          {greeting()}, {firstName} <span className="text-ink-3">·</span> <MarketStatus />
        </p>

        <Reveal className="flex flex-col gap-10" stagger={0.08}>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <CountUp
                value={totalValue}
                decimals={2}
                prefix="$"
                className="figure block text-[clamp(40px,11vw,64px)] leading-[1] text-ink"
              />
              <p className={`num mt-2 text-[15px] ${dayPl > 0 ? 'text-up' : dayPl < 0 ? 'text-down' : 'text-ink-3'}`}>
                {signed(dayPl)} ({signedPct(dayPlPercent)}) today
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-2">
              <SearchCommand
                renderAs="button"
                label="Add symbol"
                initialStocks={initialStocks}
                quickAddEnabled
                pill
                className="!w-auto !max-w-none !justify-center !border-transparent !bg-signal !px-4 !font-semibold !text-signal-ink hover:!bg-signal-hover"
              />
              <Link href="/watchlist" className="text-btn">
                New alert
              </Link>
              <Link href="/research" className="text-btn">
                Run research
              </Link>
            </div>
          </div>

          <PortfolioHeroChart seriesByRange={seriesByRange} className="-mt-4" />

          <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-x-12 sm:gap-y-5">
            <StatPair
              label="Day P&L"
              value={`${signed(dayPl)} (${signedPct(dayPlPercent)})`}
              tone={dayPl > 0 ? 'up' : dayPl < 0 ? 'down' : 'neutral'}
              full
            />
            <StatPair label="Cash" value={formatPrice(cash)} />
            <StatPair label="Invested" value={formatPrice(invested)} />
          </div>
        </Reveal>
      </div>

      <Reveal className="grid gap-16 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" stagger={0.08}>
        <div className="min-w-0">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="section-title">Watchlist</h2>
            <Link href="/watchlist" className="text-sm text-ink-2 hover:text-ink">
              Open watchlist
            </Link>
          </div>
          {watchlist.length === 0 ? (
            <div>
              <p className="text-sm text-ink">No symbols yet.</p>
              <p className="mt-1 text-sm text-ink-3">
                Add a ticker with Add symbol and its price and move show up here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col text-sm">
              {watchlist.slice(0, 8).map((row) => {
                const sym = row.symbol.toUpperCase();
                const q = quoteMap.get(sym);
                const ch = q?.change ?? 0;
                return (
                  <Link
                    href={`/stocks/${sym}`}
                    key={sym}
                    className="flex items-center justify-between gap-4 border-b border-line py-3.5 last:border-0"
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="num shrink-0 font-semibold text-ink">{sym}</span>
                      <span className="hidden min-w-0 truncate text-ink-3 min-[420px]:inline" title={row.company}>
                        {row.company}
                      </span>
                    </span>
                    <span className="flex flex-none items-baseline gap-4">
                      <span className="num w-20 text-right text-ink">
                        {q?.price != null ? formatPrice(q.price) : '—'}
                      </span>
                      <span className={`num w-16 text-right ${ch >= 0 ? 'text-up' : 'text-down'}`}>
                        {q?.change != null ? signedPct(ch) : <span className="text-ink-3">—</span>}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="section-title">Research</h2>
            <Link href="/research" className="text-sm text-ink-2 hover:text-ink">
              New report
            </Link>
          </div>
          {typedReports.length === 0 ? (
            <Link href="/research" className="block">
              <div className="text-sm font-semibold text-ink">No reports yet</div>
              <p className="mt-1 text-sm leading-normal text-ink-3">
                Pick a symbol: Signalist computes the factors first, then writes a narrative that
                only cites those numbers.
              </p>
            </Link>
          ) : (
            <ul>
              {typedReports.map((r, i) => {
                const conf = Math.round((r.confidence ?? 0.7) * 100);
                const key =
                  (r._id && String(r._id)) ||
                  `${r.symbol}-${r.createdAt ? new Date(r.createdAt).getTime() : i}-${i}`;
                return (
                  <li key={key} className="border-b border-line py-3.5 last:border-0">
                    <Link href={`/research?symbol=${r.symbol}`} className="block">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="num text-sm font-semibold text-ink">{r.symbol}</span>
                        <span className="num text-[13px] text-ink-3">{conf}% confidence</span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-sm leading-normal text-ink-2">
                        {r.summary || 'Research report'}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Reveal>
    </PageEnter>
  );
}

function signed(n: number) {
  return `${n >= 0 ? '+' : '−'}${formatPrice(Math.abs(n))}`;
}

function signedPct(n: number) {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}%`;
}

function StatPair({
  label,
  value,
  tone = 'neutral',
  full = false,
}: {
  label: string;
  value: string;
  tone?: 'up' | 'down' | 'neutral';
  full?: boolean;
}) {
  const color = tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-ink';
  return (
    <div className={`min-w-0 ${full ? 'col-span-2 sm:col-span-1' : ''}`}>
      <p className="meta truncate">{label}</p>
      <p
        className={`num mt-1 text-[17px] font-semibold sm:truncate sm:text-xl ${full ? '' : 'truncate'} ${color}`}
      >
        {value}
      </p>
    </div>
  );
}
