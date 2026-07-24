'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, Loader2, Minus, Plus, RefreshCw, Sparkles } from 'lucide-react';
import {
  getCachedAiResearch,
  getExtraIndicators,
  getResearchHeader,
  runAiResearch,
  type ResearchFullResult,
} from '@/lib/actions/ai.actions';
import { ConfidenceMeter } from '@/components/ui/confidence-meter';
import { PageEnter } from '@/components/ui/motion';
import { Skeleton } from '@/components/ui/skeleton';
import { notify } from '@/lib/notify';
import { cn, formatPrice } from '@/lib/utils';

type Stance = 'buy' | 'sell' | 'wait' | 'caution' | 'na';

const STANCE_STYLE: Record<Stance, string> = {
  buy: 'bg-[rgba(34,197,94,0.12)] text-[#22C55E]',
  sell: 'bg-[rgba(239,68,68,0.12)] text-[#EF4444]',
  wait: 'bg-[rgba(161,161,161,0.12)] text-[#A1A1A1]',
  caution: 'bg-[rgba(253,212,88,0.12)] text-[#FDD458]',
  na: 'bg-[#1C1C1C] text-[#6E6E6E]',
};

const STANCE_LABEL: Record<Stance, string> = {
  buy: 'Buy lean',
  sell: 'Sell lean',
  wait: 'Indecisive',
  caution: 'Caution',
  na: 'No data',
};

function initials(name: string, symbol: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return symbol.slice(0, 2).toUpperCase();
}

function clampScore(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function factorTone(score: number): {
  bar: string;
  text: string;
  label: 'Strong' | 'Moderate' | 'Weak';
} {
  if (score >= 65) return { bar: '#22C55E', text: 'text-[#22C55E]', label: 'Strong' };
  if (score >= 40) return { bar: '#FDD458', text: 'text-[#FDD458]', label: 'Moderate' };
  return { bar: '#EF4444', text: 'text-[#EF4444]', label: 'Weak' };
}

function isCryptoSym(sym: string) {
  return /USDT$|USDC$|USD$|BTC$|ETH$|BNB$/i.test(sym) && sym.length >= 5;
}

function deriveStance(
  score: number | null | undefined,
  snap: Record<string, any> | undefined
): { stance: Stance; sentence: string } {
  if (score == null || !snap?.score?.components) {
    return {
      stance: 'na',
      sentence: 'Not enough data yet for a clear lean.',
    };
  }
  const rsi = snap.momentum?.rsi_14 as number | undefined;
  const daysEarn = snap.event?.days_to_next_earnings as number | undefined;
  const caution =
    (typeof rsi === 'number' && rsi > 70) ||
    (typeof daysEarn === 'number' && daysEarn < 7);

  let stance: Stance =
    score >= 65 ? 'buy' : score <= 35 ? 'sell' : 'wait';
  if (caution) stance = 'caution';

  const sentence =
    stance === 'buy'
      ? 'More evidence leans toward adding or holding on dips — still a lean, not a hard buy.'
      : stance === 'sell'
        ? 'More evidence leans against buying here — wait for a clearer turn or reduce risk.'
        : stance === 'caution'
          ? 'Setup is stretched or event-risk is near — size smaller and wait for confirmation.'
          : 'Mixed signals — wait for a clearer trend before acting.';

  return { stance, sentence };
}

type FactorCard = { key: string; score: number; sector: number; why: string };

/** Map quant snapshot → Factor Pack cards (0–100) with plain-English why. */
function buildFactorPack(snap: Record<string, any> | undefined): FactorCard[] {
  if (!snap?.score?.components) return [];

  const comps = snap.score.components as Record<string, number>;
  const asPct = (key: string, fallback = 0.5) =>
    clampScore((typeof comps[key] === 'number' ? comps[key] : fallback) * 100);

  const trend = asPct('trend');
  const momentum = asPct('momentum');
  const volatility = asPct('volatility_inv');
  const quality = asPct('quality');
  const crypto = isCryptoSym(String(snap.symbol || ''));

  const pe = snap.quality?.pe as number | undefined;
  let value = 50;
  let valueWhy = crypto
    ? 'N/A for crypto — no earnings multiple.'
    : 'No PE available — neutral value score.';
  if (typeof pe === 'number' && pe > 0) {
    if (pe < 15) {
      value = 78;
      valueWhy = `PE ${pe.toFixed(1)} looks cheap vs history norms.`;
    } else if (pe < 25) {
      value = 58;
      valueWhy = `PE ${pe.toFixed(1)} is roughly mid-range.`;
    } else if (pe < 40) {
      value = 38;
      valueWhy = `PE ${pe.toFixed(1)} is elevated — pricey on earnings.`;
    } else {
      value = 22;
      valueWhy = `PE ${pe.toFixed(1)} is rich — limited value cushion.`;
    }
  }

  const g = snap.quality?.revenue_growth_yoy as number | undefined;
  let growth = asPct('relative');
  let growthWhy =
    typeof snap.relative?.excess_return_1m === 'number'
      ? `1M excess vs SPY ${(snap.relative.excess_return_1m * 100).toFixed(1)}%.`
      : 'Relative strength vs SPY used as growth proxy.';
  if (typeof g === 'number') {
    growth = clampScore(50 + g * 100);
    growthWhy = `Revenue growth YoY ${(g * 100).toFixed(1)}%.`;
  } else if (crypto) {
    growthWhy =
      typeof snap.returns?.r_1m === 'number'
        ? `1M price return ${(snap.returns.r_1m * 100).toFixed(1)}% (crypto has no revenue growth).`
        : 'N/A for crypto fundamentals — using price momentum proxy.';
  }

  const excess = snap.relative?.excess_return_1m as number | undefined;
  const sectorDelta = (base: number) => {
    if (typeof excess !== 'number') return Math.round((base - 50) / 2);
    return Math.round(excess * 100 + (base - 55) / 4);
  };

  const above = [
    snap.trend?.above_sma_20 ? '20d' : null,
    snap.trend?.above_sma_50 ? '50d' : null,
    snap.trend?.above_sma_200 ? '200d' : null,
  ].filter(Boolean);
  const below = [
    snap.trend?.above_sma_20 === false ? '20d' : null,
    snap.trend?.above_sma_50 === false ? '50d' : null,
    snap.trend?.above_sma_200 === false ? '200d' : null,
  ].filter(Boolean);
  const trendWhy =
    above.length === 3
      ? 'Price holds above 20/50/200-day averages.'
      : below.length === 3
        ? 'Price sits below 20/50/200-day averages.'
        : above.length
          ? `Above ${above.join('/')} averages; mixed elsewhere.`
          : below.length
            ? `Below ${below.join('/')} averages.`
            : 'Trend averages not available.';

  const rsi = snap.momentum?.rsi_14 as number | undefined;
  const momentumWhy =
    typeof rsi === 'number'
      ? rsi >= 70
        ? `RSI ${rsi.toFixed(0)} — stretched (overbought).`
        : rsi <= 30
          ? `RSI ${rsi.toFixed(0)} — washed out (oversold).`
          : `RSI ${rsi.toFixed(0)} — mid-range momentum.`
      : 'RSI not available.';

  const rvol = snap.volatility?.realized_vol_20d_annualized as number | undefined;
  const volWhy =
    typeof rvol === 'number'
      ? rvol > 0.45
        ? `Realized vol ${(rvol * 100).toFixed(0)}% — choppy.`
        : rvol < 0.2
          ? `Realized vol ${(rvol * 100).toFixed(0)}% — relatively calm.`
          : `Realized vol ${(rvol * 100).toFixed(0)}% — moderate.`
      : 'Volatility not available.';

  const qualityWhy = crypto
    ? 'N/A for crypto — no margins or balance sheet.'
    : typeof pe === 'number'
      ? 'Blended from PE, margins, and leverage when available.'
      : 'Limited fundamentals — score stays near neutral.';

  return [
    { key: 'Trend', score: trend, sector: sectorDelta(trend), why: trendWhy },
    { key: 'Momentum', score: momentum, sector: sectorDelta(momentum), why: momentumWhy },
    { key: 'Volatility', score: volatility, sector: sectorDelta(volatility), why: volWhy },
    { key: 'Quality', score: quality, sector: sectorDelta(quality), why: qualityWhy },
    { key: 'Value', score: value, sector: sectorDelta(value), why: valueWhy },
    { key: 'Growth', score: growth, sector: sectorDelta(growth), why: growthWhy },
  ];
}

function deriveCases(snap: Record<string, any> | undefined, narrative: Record<string, any> | undefined) {
  const crypto = snap ? isCryptoSym(String(snap.symbol || '')) : false;
  const bull =
    (Array.isArray(narrative?.bull_case) && narrative.bull_case.length
      ? narrative.bull_case.map(String)
      : null) ||
    (() => {
      if (!snap) return ['Run research to generate a bull case.'];
      const out: string[] = [];
      if (snap.trend?.above_sma_20) out.push('Holding above the 20-day moving average.');
      if (snap.momentum?.rsi_14 != null && snap.momentum.rsi_14 >= 45 && snap.momentum.rsi_14 <= 65) {
        out.push(`RSI in neutral territory (${Number(snap.momentum.rsi_14).toFixed(0)}).`);
      }
      if (snap.momentum?.macd_hist != null && snap.momentum.macd_hist > 0) {
        out.push('MACD histogram is positive.');
      }
      if (snap.trend?.above_sma_50) out.push('Price remains above the 50-day average.');
      return out.length ? out : ['No clear bullish technicals in the current snapshot.'];
    })();

  const bear =
    (Array.isArray(narrative?.bear_case) && narrative.bear_case.length
      ? narrative.bear_case.map(String)
      : null) ||
    (() => {
      if (!snap) return ['Run research to generate a bear case.'];
      const out: string[] = [];
      if (snap.levels?.nearest_resistance != null) {
        out.push(`Resistance near ${Number(snap.levels.nearest_resistance).toFixed(0)}.`);
      }
      if (
        !crypto &&
        snap.event?.days_to_next_earnings != null &&
        snap.event.days_to_next_earnings < 30
      ) {
        out.push('Upcoming earnings may add short-term volatility.');
      }
      if (snap.momentum?.rsi_14 != null && snap.momentum.rsi_14 > 70) {
        out.push(`RSI elevated at ${Number(snap.momentum.rsi_14).toFixed(0)}.`);
      }
      if (snap.trend?.above_sma_20 === false) out.push('Trading below the 20-day moving average.');
      return out.length ? out : ['No clear bearish technicals in the current snapshot.'];
    })();

  const catalysts =
    (Array.isArray(narrative?.catalysts) && narrative.catalysts.length
      ? narrative.catalysts.map((c: any) => ({
          when: String(c.when ?? c.date ?? 'TBD'),
          label: String(c.label ?? c.name ?? 'Event'),
        }))
      : null) ||
    (() => {
      const out: { when: string; label: string }[] = [];
      if (!crypto && snap?.event?.days_to_next_earnings != null) {
        out.push({
          when: `in ${snap.event.days_to_next_earnings}d`,
          label: 'Earnings window',
        });
      }
      return out;
    })();

  return { bull, bear, catalysts };
}

type Props = {
  initialSymbols: string[];
  initialSymbol: string;
};

export default function ResearchClient({ initialSymbols, initialSymbol }: Props) {
  const router = useRouter();
  const requestId = useRef(0);
  const [symbols] = useState(() =>
    Array.from(new Set(initialSymbols.map((s) => s.toUpperCase()).filter(Boolean)))
  );
  const [symbol, setSymbol] = useState(initialSymbol);
  const [report, setReport] = useState<ResearchFullResult | null>(null);
  const [header, setHeader] = useState<{
    symbol?: string;
    name: string;
    exchange?: string;
    logo?: string;
    price?: number;
    change?: number;
    changePercent?: number;
    isInWatchlist: boolean;
    aiScore?: number | null;
  } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const reportCache = useRef<Map<string, ResearchFullResult>>(new Map());

  const pills = useMemo(() => {
    if (!symbol) return symbols;
    if (symbols.includes(symbol)) return symbols;
    return [symbol, ...symbols];
  }, [symbols, symbol]);

  const loadHeader = useCallback(async (sym: string, id: number) => {
    const res = await getResearchHeader(sym);
    if (id !== requestId.current) return;
    if (res.success && res.data) {
      const returned = (res.data as { symbol?: string }).symbol?.toUpperCase();
      if (returned && returned !== sym.toUpperCase()) return;
      setHeader({ ...res.data, symbol: sym });
    }
  }, []);

  /** Fast path: DB cache / in-memory. Full FastAPI only when missing or regenerate. */
  const loadResearch = useCallback(
    (sym: string, regenerate = false) => {
      if (!sym) return;
      const id = ++requestId.current;
      setError(null);

      const cached = reportCache.current.get(sym);
      if (!regenerate && cached) {
        setReport(cached);
        void loadHeader(sym, id);
        return;
      }

      startTransition(async () => {
        await loadHeader(sym, id);
        if (id !== requestId.current) return;

        if (!regenerate) {
          const cachedRes = await getCachedAiResearch(sym);
          if (id !== requestId.current) return;
          if (cachedRes.success && cachedRes.data) {
            reportCache.current.set(sym, cachedRes.data);
            setReport(cachedRes.data);
            setUpdatedAt(new Date());
            return;
          }
        }

        const q = regenerate
          ? `Regenerate full research brief on ${sym}`
          : `Should I watch ${sym}?`;
        const res = await runAiResearch(sym, q);
        if (id !== requestId.current) return;
        if (!res.success) {
          setError(res.message || 'Research failed');
          notify.error('Research failed', res.message);
          return;
        }
        if (res.data.symbol && res.data.symbol.toUpperCase() !== sym.toUpperCase()) return;
        reportCache.current.set(sym, res.data);
        setReport(res.data);
        setUpdatedAt(new Date());
        if (res.data.snapshot && typeof (res.data.snapshot as any)?.score?.total === 'number') {
          setHeader((h) =>
            h && h.symbol === sym
              ? { ...h, aiScore: (res.data.snapshot as any).score.total }
              : h
          );
        }
        void getExtraIndicators(sym);
        if (regenerate) notify.success('Research regenerated');
      });
    },
    [loadHeader]
  );

  useEffect(() => {
    if (initialSymbol) loadResearch(initialSymbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectSymbol = (sym: string) => {
    const next = sym.toUpperCase();
    setSymbol(next);
    router.replace(`/research?symbol=${next}`, { scroll: false });
    const warm = reportCache.current.get(next);
    if (warm) {
      setReport(warm);
      setError(null);
      loadResearch(next, false);
      return;
    }
    setReport(null);
    setHeader(null);
    setUpdatedAt(null);
    setError(null);
    loadResearch(next, false);
  };

  const snap = report?.snapshot as Record<string, any> | undefined;
  const narrative = report?.narrative as Record<string, any> | undefined;
  const factors = useMemo(() => buildFactorPack(snap), [snap]);
  const { bull, bear, catalysts } = useMemo(
    () => deriveCases(snap, narrative),
    [snap, narrative]
  );

  const company = header?.name || symbol;
  const price = header?.price ?? snap?.trend?.price;
  const changePct = header?.changePercent;
  const change = header?.change;
  const up = (changePct ?? 0) >= 0;
  const aiScore = header?.aiScore ?? snap?.score?.total ?? null;
  const { stance, sentence: stanceSentence } = useMemo(
    () => deriveStance(typeof aiScore === 'number' ? aiScore : null, snap),
    [aiScore, snap]
  );

  const confidencePct = (() => {
    if (typeof report?.confidence === 'number') {
      return Math.round(report.confidence <= 1 ? report.confidence * 100 : report.confidence);
    }
    if (typeof narrative?.confidence === 'number') {
      return Math.round(Number(narrative.confidence));
    }
    return 0;
  })();

  const updatedLabel = updatedAt
    ? (() => {
        const mins = Math.max(0, Math.floor((Date.now() - updatedAt.getTime()) / 60000));
        if (mins < 1) return 'Updated just now';
        if (mins < 60) return `Updated ${mins}m ago`;
        return `Updated ${Math.floor(mins / 60)}h ago`;
      })()
    : null;

  if (!symbols.length && !symbol) {
    return (
      <PageEnter className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-1 md:px-0">
        <div className="text-xs uppercase tracking-[0.02em] text-[#6E6E6E]">Research</div>
        <div className="rounded-xl border border-[#242424] bg-[#141414] px-5 py-8">
          <h1 className="text-lg font-semibold text-[#F5F5F5]">Your watchlist is empty</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-[#A1A1A1]">
            Research runs on symbols you follow. Add names on Watchlist, then come back to
            generate factor packs and AI briefs.
          </p>
          <Link
            href="/watchlist"
            className="mt-5 inline-flex rounded-lg bg-[#FDD458] px-4 py-2 text-[13px] font-semibold text-[#0A0A0A] hover:bg-[#E8BA40]"
          >
            Go to watchlist
          </Link>
        </div>
      </PageEnter>
    );
  }

  return (
    <PageEnter className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-1 md:px-0">
      <div className="text-xs uppercase tracking-[0.02em] text-[#6E6E6E]">
        Research
        <span className="mx-1.5 text-[#2E2E2E]">/</span>
        <span className="mono text-[#A1A1A1]">{symbol || '—'}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {pills.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => selectSymbol(s)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              symbol === s
                ? 'bg-[#FDD458] text-[#0A0A0A]'
                : 'border border-[#2E2E2E] bg-transparent text-[#A1A1A1] hover:border-[#3A3A3A] hover:text-[#F5F5F5]'
            )}
          >
            {s}
          </button>
        ))}
        <Link
          href="/watchlist"
          className="rounded-full border border-dashed border-[#2E2E2E] px-3 py-1.5 text-[12px] text-[#6E6E6E] hover:border-[#FDD458] hover:text-[#FDD458]"
        >
          Manage watchlist
        </Link>
      </div>

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            {header?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={header.logo}
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
            {header?.exchange ? (
              <span className="rounded border border-[#2E2E2E] px-1.5 py-0.5 text-[11px] text-[#6E6E6E]">
                {header.exchange.split(/[\s/-]/)[0]}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            {price != null ? (
              <div className="mono text-[32px] font-medium leading-10 text-[#F5F5F5]">
                {formatPrice(Number(price))}
              </div>
            ) : (
              <Skeleton className="h-10 w-36" />
            )}
            {changePct != null ? (
              <span
                className={cn(
                  'mono text-[13px]',
                  up ? 'text-[#22C55E]' : 'text-[#EF4444]'
                )}
              >
                {change != null
                  ? `${up ? '+' : ''}${change.toFixed(2)} (${up ? '+' : ''}${changePct.toFixed(2)}%)`
                  : `${up ? '+' : ''}${changePct.toFixed(2)}%`}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2.5 md:items-end">
          {aiScore != null ? (
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
        </div>
      </div>

      {/* Verdict strip */}
      <div className="rounded-xl border border-[#242424] bg-[#141414] px-4 py-3.5 md:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[12px] font-medium',
              STANCE_STYLE[stance]
            )}
          >
            {STANCE_LABEL[stance]}
          </span>
          <p className="min-w-0 flex-1 text-[13px] leading-5 text-[#F5F5F5]">{stanceSentence}</p>
          <span className="text-[11px] text-[#6E6E6E]">
            Horizon: ~1 month (20d / 1M factors)
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-[#6E6E6E]">
          Educational lean only — not a personal buy/sell order. Pair with your own risk limits.
        </p>
      </div>

      <div>
        <div className="mb-3 text-[11px] uppercase tracking-[0.02em] text-[#6E6E6E]">
          Factor pack
        </div>
        {isPending && !report ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[128px] rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {(factors.length
              ? factors
              : ['Trend', 'Momentum', 'Volatility', 'Quality', 'Value', 'Growth'].map((k) => ({
                  key: k,
                  score: 0,
                  sector: 0,
                  why: 'Waiting on research data…',
                }))
            ).map((f) => {
              const tone = factorTone(f.score);
              const empty = !factors.length;
              return (
                <div
                  key={f.key}
                  className="rounded-xl border border-[#242424] bg-[#141414] p-3.5"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="text-[13px] text-[#A1A1A1]">{f.key}</span>
                    <span className="mono text-[13px] text-[#F5F5F5]">
                      {empty ? '—' : f.score}
                    </span>
                  </div>
                  <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[#1C1C1C]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${empty ? 0 : f.score}%`,
                        background: tone.bar,
                      }}
                    />
                  </div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'text-[12px] font-medium',
                        empty ? 'text-[#6E6E6E]' : tone.text
                      )}
                    >
                      {empty ? '—' : tone.label}
                    </span>
                    {!empty ? (
                      <span className="mono text-[11px] text-[#6E6E6E]">
                        vs bench {f.sector >= 0 ? '+' : ''}
                        {f.sector}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] leading-4 text-[#6E6E6E]">{f.why}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        className="rounded-xl border border-[#242424] border-l-2 border-l-[#FDD458] bg-[#141414] p-5 md:p-6"
        style={{ boxShadow: '0 0 40px -24px rgba(249,115,22,0.35)' }}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-4 text-[#FDD458]" strokeWidth={1.5} />
            <span className="text-xs uppercase tracking-[0.02em] text-[#6E6E6E]">
              AI research
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-40">
              <ConfidenceMeter value={confidencePct} label="Data confidence" />
              <p className="mt-1 text-[10px] leading-3 text-[#6E6E6E]">
                Input completeness — not odds of a bear market
              </p>
            </div>
            {updatedLabel ? (
              <span className="text-[12px] text-[#6E6E6E]">{updatedLabel}</span>
            ) : null}
            <button
              type="button"
              disabled={isPending || !symbol}
              onClick={() => loadResearch(symbol, true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2E2E2E] px-3 py-1.5 text-[12px] text-[#A1A1A1] hover:border-[#3A3A3A] hover:text-[#F5F5F5] disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" strokeWidth={1.5} />
              )}
              Regenerate
            </button>
          </div>
        </div>

        {isPending && !report ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          </div>
        ) : error && !report ? (
          <div className="rounded-lg border border-[#EF4444]/30 bg-[rgba(239,68,68,0.06)] px-4 py-5">
            <p className="text-sm font-medium text-[#EF4444]">Couldn’t load research</p>
            <p className="mt-1.5 text-[13px] leading-5 text-[#A1A1A1]">{error}</p>
            <button
              type="button"
              onClick={() => loadResearch(symbol, true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#2E2E2E] px-3 py-1.5 text-[12px] text-[#F5F5F5] hover:border-[#FDD458] hover:text-[#FDD458]"
            >
              <RefreshCw className="size-3.5" strokeWidth={1.5} />
              Retry
            </button>
          </div>
        ) : (
          <>
            <p className="mb-6 max-w-4xl text-sm leading-6 text-[#F5F5F5]">
              {report?.summary ||
                narrative?.summary ||
                'Select a symbol to generate a quant-backed research brief.'}
            </p>

            <div className="mb-6 grid gap-6 md:grid-cols-3">
              <div>
                <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.02em] text-[#22C55E]">
                  Bull case
                </div>
                <ul className="space-y-2.5">
                  {bull.map((item, i) => (
                    <li key={i} className="flex gap-2 text-[13px] leading-5 text-[#F5F5F5]">
                      <Plus className="mt-0.5 size-3.5 shrink-0 text-[#22C55E]" strokeWidth={2} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.02em] text-[#EF4444]">
                  Bear case
                </div>
                <ul className="space-y-2.5">
                  {bear.map((item, i) => (
                    <li key={i} className="flex gap-2 text-[13px] leading-5 text-[#F5F5F5]">
                      <Minus className="mt-0.5 size-3.5 shrink-0 text-[#EF4444]" strokeWidth={2} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.02em] text-[#FDD458]">
                  Catalysts
                </div>
                {catalysts.length ? (
                  <ul className="space-y-2.5">
                    {catalysts.map((c, i) => (
                      <li
                        key={i}
                        className="flex items-start justify-between gap-3 text-[13px] leading-5"
                      >
                        <span className="mono shrink-0 text-[#6E6E6E]">{c.when}</span>
                        <span className="text-right text-[#F5F5F5]">{c.label}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-[#6E6E6E]">
                    {isCryptoSym(symbol)
                      ? 'No earnings calendar for crypto pairs.'
                      : 'No near-term catalysts mapped.'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-[#242424] pt-4">
              <div className="flex flex-wrap gap-2">
                {!isCryptoSym(symbol)
                  ? [
                      {
                        label: '10-Q filing',
                        href: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${symbol}&type=10-Q`,
                      },
                      {
                        label: 'Earnings call transcript',
                        href: `https://finance.yahoo.com/quote/${symbol}/analysis`,
                      },
                      {
                        label: 'Analyst estimates',
                        href: `https://finance.yahoo.com/quote/${symbol}/analysis`,
                      },
                    ].map((b) => (
                      <a
                        key={b.label}
                        href={b.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#2E2E2E] px-3 py-1.5 text-[12px] text-[#A1A1A1] hover:border-[#3A3A3A] hover:text-[#FDD458]"
                      >
                        {b.label}
                        <ExternalLink className="size-3" strokeWidth={1.5} />
                      </a>
                    ))
                  : (
                      <a
                        href={`https://www.binance.com/en/trade/${symbol}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#2E2E2E] px-3 py-1.5 text-[12px] text-[#A1A1A1] hover:border-[#3A3A3A] hover:text-[#FDD458]"
                      >
                        Binance market
                        <ExternalLink className="size-3" strokeWidth={1.5} />
                      </a>
                    )}
                <Link
                  href={`/stocks/${symbol}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#2E2E2E] px-3 py-1.5 text-[12px] text-[#A1A1A1] hover:border-[#3A3A3A] hover:text-[#FDD458]"
                >
                  Open chart
                </Link>
              </div>
              <p className="text-[11px] text-[#6E6E6E]">
                Not investment advice. Educational use only.
              </p>
            </div>
          </>
        )}
      </div>
    </PageEnter>
  );
}
