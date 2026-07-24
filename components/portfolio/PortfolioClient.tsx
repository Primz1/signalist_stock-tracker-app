'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Pencil,
  RefreshCw,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { PageEnter } from '@/components/ui/motion';
import { SectorsDonut } from '@/components/ui/sectors-donut';
import { ConfidenceMeter } from '@/components/ui/confidence-meter';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  executeTrade,
  getPortfolioAiReview,
  getPortfolioTearsheet,
  getTradeHistory,
  type TearsheetResult,
  type TradeRow,
} from '@/lib/actions/portfolio.actions';
import { notify } from '@/lib/notify';
import { cn, formatPrice } from '@/lib/utils';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Holding = {
  symbol: string;
  company: string;
  quantity: number;
  avgCost: number;
  price?: number;
  value?: number;
  pl?: number;
  changePercent?: number;
  dayPl?: number;
};

type PortfolioData = {
  cash: number;
  initialCash: number;
  holdings: Holding[];
  totalValue: number;
  plTotal: number;
  plPercent: number;
  dayPl?: number;
  dayPlPercent?: number;
};

const CAPITAL_GUARD = {
  maxSingleWeight: 0.25,
  minCashReserve: 0.1,
  maxTradeSize: 2500,
};

const JOURNAL_KEY = 'signalist_week_journal';
const RANGES = ['1D', '1W', '1M', '3M', 'YTD', 'ALL'] as const;

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))}m ago`;
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function compactUsd(n: number) {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatAxisTick(d: Date, rangeLabel: string) {
  if (rangeLabel === '1D') {
    const h = d.getHours();
    const m = d.getMinutes();
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return m === 0 ? `${h12}${suffix}` : `${h12}:${pad2(m)}${suffix}`;
  }
  if (rangeLabel === '1W') {
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
  }
  if (rangeLabel === 'YTD' || rangeLabel === 'ALL') {
    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  // 1M / 3M
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTooltipTime(d: Date, rangeLabel: string) {
  if (rangeLabel === '1D') {
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Build evenly spaced timestamps ending at "now" for the selected range. */
function buildTimeline(rangeLabel: string): Date[] {
  const now = new Date();

  if (rangeLabel === '1D') {
    // Regular session cadence: 9:30 → 16:00 ET-style half hours (local clock)
    const end = new Date(now);
    end.setSeconds(0, 0);
    // snap to latest half-hour at or before now, capped at 16:00
    const sessionEnd = new Date(now);
    sessionEnd.setHours(16, 0, 0, 0);
    const sessionStart = new Date(now);
    sessionStart.setHours(9, 30, 0, 0);
    const cursor = end > sessionEnd ? new Date(sessionEnd) : new Date(end);
    cursor.setMinutes(cursor.getMinutes() - (cursor.getMinutes() % 30), 0, 0);
    const points: Date[] = [];
    const start = sessionStart < cursor ? sessionStart : new Date(cursor.getTime() - 6.5 * 3600000);
    for (let t = start.getTime(); t <= cursor.getTime(); t += 30 * 60000) {
      points.push(new Date(t));
    }
    if (points.length < 2) {
      return [new Date(now.getTime() - 6.5 * 3600000), now];
    }
    return points;
  }

  if (rangeLabel === '1W') {
    // Last 5 weekdays including today
    const days: Date[] = [];
    const cursor = new Date(now);
    cursor.setHours(16, 0, 0, 0);
    while (days.length < 5) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) {
        days.unshift(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    return days;
  }

  if (rangeLabel === '1M') {
    // ~1 month, every 2 trading-ish days → ~15 dated points
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    start.setHours(16, 0, 0, 0);
    const n = 16;
    return Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      return new Date(start.getTime() + t * (now.getTime() - start.getTime()));
    });
  }

  if (rangeLabel === '3M') {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 3);
    start.setHours(16, 0, 0, 0);
    const n = 14;
    return Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      return new Date(start.getTime() + t * (now.getTime() - start.getTime()));
    });
  }

  if (rangeLabel === 'YTD') {
    const start = new Date(now.getFullYear(), 0, 1, 16, 0, 0, 0);
    const months =
      Math.max(2, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1);
    return Array.from({ length: months }, (_, i) => {
      if (i === months - 1) return new Date(now);
      return new Date(now.getFullYear(), i, 1, 16, 0, 0, 0);
    });
  }

  // ALL — trailing 12 months, monthly
  const start = new Date(now);
  start.setFullYear(start.getFullYear() - 1);
  start.setDate(1);
  start.setHours(16, 0, 0, 0);
  const n = 13;
  return Array.from({ length: n }, (_, i) => {
    if (i === n - 1) return new Date(now);
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    return d;
  });
}

function PerformanceChart({
  start,
  end,
  up,
  rangeLabel,
  equitySeries,
}: {
  start: number;
  end: number;
  up: boolean;
  rangeLabel: string;
  equitySeries?: { t: string; v: number }[];
}) {
  const data = useMemo(() => {
    if (equitySeries && equitySeries.length >= 2) {
      // Slice by range roughly
      const now = Date.now();
      const ms =
        rangeLabel === '1D'
          ? 2 * 86400000
          : rangeLabel === '1W'
            ? 8 * 86400000
            : rangeLabel === '1M'
              ? 35 * 86400000
              : rangeLabel === '3M'
                ? 95 * 86400000
                : rangeLabel === 'YTD'
                  ? now - new Date(new Date().getFullYear(), 0, 1).getTime()
                  : 400 * 86400000;
      const cutoff = now - ms;
      const sliced = equitySeries.filter((p) => new Date(p.t).getTime() >= cutoff);
      const pts = (sliced.length >= 2 ? sliced : equitySeries).map((p) => {
        const at = new Date(p.t);
        return {
          at: at.getTime(),
          label: formatAxisTick(at, rangeLabel === '1D' ? '1M' : rangeLabel),
          tip: formatTooltipTime(at, rangeLabel === '1D' ? '1M' : rangeLabel),
          value: p.v,
        };
      });
      return pts;
    }

    const times = buildTimeline(rangeLabel);
    const n = times.length;
    const delta = end - start;
    return times.map((at, i) => {
      const t = n <= 1 ? 1 : i / (n - 1);
      const ease = t * t * (3 - 2 * t);
      const noise =
        Math.sin(i * 1.15 + 0.4) * 0.028 * (1 - t * 0.65) * Math.max(Math.abs(delta), start * 0.04);
      return {
        at: at.getTime(),
        label: formatAxisTick(at, rangeLabel),
        tip: formatTooltipTime(at, rangeLabel),
        value: Math.max(0, start + delta * ease + noise),
      };
    });
  }, [start, end, rangeLabel, equitySeries]);

  const stroke = up ? '#FDD458' : '#EF4444';
  const fillId = up ? 'pfFillUp' : 'pfFillDown';
  const tickInterval =
    rangeLabel === '1D' ? 2 : rangeLabel === '1W' ? 0 : rangeLabel === '1M' ? 2 : rangeLabel === '3M' ? 1 : 0;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#242424" strokeDasharray="4 4" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#6E6E6E', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
          axisLine={{ stroke: '#2E2E2E' }}
          tickLine={false}
          interval={tickInterval}
          minTickGap={20}
        />
        <YAxis
          tickFormatter={compactUsd}
          tick={{ fill: '#6E6E6E', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
          axisLine={false}
          tickLine={false}
          width={52}
          domain={['auto', 'auto']}
        />
        <Tooltip
          cursor={{ stroke: '#2E2E2E', strokeWidth: 1 }}
          contentStyle={{
            background: '#141414',
            border: '1px solid #2E2E2E',
            borderRadius: 8,
            fontSize: 12,
            color: '#F5F5F5',
          }}
          labelStyle={{ color: '#6E6E6E' }}
          labelFormatter={(_, payload) => {
            const tip = payload?.[0]?.payload?.tip;
            return typeof tip === 'string' ? tip : '';
          }}
          formatter={(value) => [formatPrice(Number(value ?? 0)), 'Value']}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          strokeWidth={2.25}
          fill={`url(#${fillId})`}
          dot={false}
          activeDot={{ r: 4, stroke: '#0A0A0A', strokeWidth: 2, fill: stroke }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function PortfolioClient({
  initial,
  initialRecent = [],
}: {
  initial: PortfolioData;
  initialRecent?: TradeRow[];
}) {
  const [portfolio, setPortfolio] = useState(initial);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [symbol, setSymbol] = useState('AAPL');
  const [quantity, setQuantity] = useState(5);
  const [journalNote, setJournalNote] = useState('');
  const [weekJournal, setWeekJournal] = useState('');
  const [range, setRange] = useState<(typeof RANGES)[number]>('1M');
  const [overrideGuard, setOverrideGuard] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [recent, setRecent] = useState<TradeRow[]>(initialRecent);
  const [aiReview, setAiReview] = useState<{
    summary: string;
    confidence?: number;
    snapshot?: Record<string, unknown>;
    rules_fired?: { id: string; tag: string; message: string }[];
    narrative?: Record<string, unknown>;
  } | null>(null);
  const [showWeek, setShowWeek] = useState(true);
  const [, startTransition] = useTransition();
  const [pendingKind, setPendingKind] = useState<'trade' | 'analyze' | null>(null);
  const [tearsheet, setTearsheet] = useState<TearsheetResult | null>(null);

  useEffect(() => {
    try {
      setWeekJournal(localStorage.getItem(JOURNAL_KEY) ?? '');
    } catch {
      /* ignore */
    }
    // Tearsheet is heavy (per-symbol OHLCV) — defer so first paint stays fast
    const t = window.setTimeout(() => {
      getPortfolioTearsheet().then((res) => {
        if (res.success) setTearsheet(res.data);
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, []);

  const equity = useMemo(
    () => portfolio.holdings.reduce((s, h) => s + (h.value ?? 0), 0),
    [portfolio.holdings]
  );
  const dayPl = portfolio.dayPl ?? 0;
  const dayPlPercent = portfolio.dayPlPercent ?? 0;
  const plUp = portfolio.plTotal >= 0;
  const dayUp = dayPl >= 0;

  const largest = useMemo(() => {
    if (!portfolio.holdings.length) return null;
    return [...portfolio.holdings].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  }, [portfolio.holdings]);

  const largestWeight =
    largest && portfolio.totalValue > 0
      ? ((largest.value ?? 0) / portfolio.totalValue) * 100
      : 0;
  const cashPct =
    portfolio.totalValue > 0 ? (portfolio.cash / portfolio.totalValue) * 100 : 100;

  const donutSectors = useMemo(() => {
    const sectors = [...portfolio.holdings]
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .map((h) => ({
        label: h.symbol,
        pct:
          portfolio.totalValue > 0
            ? Math.round(((h.value ?? 0) / portfolio.totalValue) * 1000) / 10
            : 0,
      }));
    const cash = Math.round(cashPct * 10) / 10;
    if (cash > 0) sectors.push({ label: 'Cash', pct: cash });
    const sum = sectors.reduce((s, x) => s + x.pct, 0);
    if (sectors.length && Math.abs(sum - 100) > 0.2) {
      sectors[sectors.length - 1].pct += 100 - sum;
    }
    return sectors.filter((s) => s.pct > 0);
  }, [portfolio, cashPct]);

  const selectedHolding = portfolio.holdings.find((h) => h.symbol === symbol.toUpperCase());
  const estPrice = selectedHolding?.price ?? 0;
  const estTotal = estPrice * quantity;
  const cashAfter =
    side === 'buy' ? portfolio.cash - estTotal : portfolio.cash + estTotal;
  const projectedWeight =
    side === 'buy' && portfolio.totalValue > 0
      ? ((((selectedHolding?.value ?? 0) + estTotal) / portfolio.totalValue) * 100)
      : selectedHolding && portfolio.totalValue > 0
        ? (((selectedHolding.value ?? 0) / portfolio.totalValue) * 100)
        : 0;

  const guardHit =
    side === 'buy' &&
    projectedWeight / 100 > CAPITAL_GUARD.maxSingleWeight &&
    !overrideGuard;
  const tradeTooLarge = estTotal > CAPITAL_GUARD.maxTradeSize && side === 'buy';

  const weekStats = useMemo(() => {
    const buys = recent.filter((t) => t.side === 'buy').length;
    const sells = recent.filter((t) => t.side === 'sell').length;
    const realized = recent.reduce((s, t) => s + (t.realizedPl ?? 0), 0);
    return { trades: recent.length, buys, sells, realized };
  }, [recent]);

  const runTrade = (force = false) => {
    if (!symbol || quantity <= 0) {
      notify.warning('Invalid quantity', 'Enter a valid share count.');
      return;
    }
    if ((guardHit || tradeTooLarge) && !force && !overrideGuard) {
      notify.warning('Capital Guard', 'Adjust size or override to continue.');
      return;
    }
    setPendingKind('trade');
    startTransition(async () => {
      try {
        const res = await executeTrade({
          symbol,
          company: selectedHolding?.company || symbol,
          side,
          quantity,
          note: journalNote.trim() || undefined,
        });
        if (!res.success) {
          notify.error('Trade failed', res.message);
          return;
        }
        setPortfolio(res.data as PortfolioData);
        getPortfolioTearsheet().then((t) => {
          if (t.success) setTearsheet(t.data);
        });
        notify.tradeFilled(side === 'buy' ? 'Buy' : 'Sell', symbol, `${quantity} shares`);
        setJournalNote('');
        setJournalOpen(false);
        setOverrideGuard(false);
        const hist = await getTradeHistory({ range: '7d' });
        if (hist.success) setRecent(hist.data.trades.slice(0, 8));
      } finally {
        setPendingKind(null);
      }
    });
  };

  const requestAiReview = () => {
    setPendingKind('analyze');
    startTransition(async () => {
      try {
        const res = await getPortfolioAiReview();
        if (!res.success) {
          notify.error('AI review failed', res.message);
          return;
        }
        setAiReview({
          summary: res.data.summary,
          confidence: res.data.confidence,
          snapshot: res.data.snapshot as Record<string, unknown> | undefined,
          rules_fired: res.data.rules_fired as
            | { id: string; tag: string; message: string }[]
            | undefined,
          narrative: res.data.narrative as Record<string, unknown> | undefined,
        });
        notify.researchReady('PORT');
      } finally {
        setPendingKind(null);
      }
    });
  };

  const saveWeekJournal = (v: string) => {
    setWeekJournal(v);
    try {
      localStorage.setItem(JOURNAL_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const snap = aiReview?.snapshot;
  const healthScore =
    typeof snap?.health_score === 'number'
      ? Math.round(snap.health_score as number)
      : typeof aiReview?.confidence === 'number'
        ? Math.round(
            (aiReview.confidence <= 1 ? aiReview.confidence * 100 : aiReview.confidence)
          )
        : null;

  const maxShares =
    side === 'buy' && estPrice > 0
      ? Math.floor(portfolio.cash / estPrice)
      : selectedHolding?.quantity ?? 0;

  return (
    <PageEnter className="mx-auto w-full max-w-[1400px] space-y-5 px-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-8 text-[#F5F5F5]">Portfolio</h1>
          <p className="mt-1 text-xs text-[#6E6E6E]">
            Practice trading with a {formatPrice(portfolio.initialCash)} virtual balance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-full border border-[rgba(253,212,88,0.4)] bg-[rgba(253,212,88,0.08)] px-2.5 py-1 text-[11px] text-[#FDD458]">
            Paper trading
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#242424] bg-[#141414] px-2.5 py-1 text-[11px] text-[#A1A1A1] hover:text-[#F5F5F5]"
          >
            Growth · Moderate risk
            <Pencil className="size-2.5" />
          </button>
          <Tabs value={range} onValueChange={(v) => setRange(v as (typeof RANGES)[number])}>
            <TabsList className="h-auto gap-0.5 rounded-lg border border-[#242424] bg-[#0A0A0A] p-[3px]">
              {RANGES.map((r) => (
                <TabsTrigger key={r} value={r} className="rounded-md px-2.5 py-1 text-[11px]">
                  {r}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 overflow-x-auto md:grid-cols-5">
        {[
          {
            l: 'Cash',
            v: formatPrice(portfolio.cash),
            bar: Math.min(100, cashPct),
            barColor: '#22C55E',
            sub: null as string | null,
            pill: false,
          },
          { l: 'Equity', v: formatPrice(equity), bar: null, barColor: '', sub: null, pill: false },
          {
            l: 'Buying power',
            v: formatPrice(portfolio.cash),
            bar: null,
            barColor: '',
            sub: '= Cash',
            pill: false,
          },
          {
            l: 'Day P/L',
            v: `${dayUp ? '+' : ''}${formatPrice(dayPl)}`,
            bar: null,
            barColor: '',
            sub: `${dayUp ? '+' : ''}${dayPlPercent.toFixed(2)}%`,
            tone: dayUp ? 'up' : 'down',
            pill: true,
          },
          {
            l: 'Total P/L',
            v: `${plUp ? '+' : ''}${formatPrice(portfolio.plTotal)}`,
            bar: null,
            barColor: '',
            sub: `${plUp ? '+' : ''}${portfolio.plPercent.toFixed(2)}%`,
            tone: plUp ? 'up' : 'down',
            pill: true,
          },
        ].map((c) => (
          <div
            key={c.l}
            className="min-w-[140px] rounded-xl border border-[#242424] bg-[#141414] p-3.5 md:min-w-0"
          >
            <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.02em] text-[#6E6E6E]">
              {c.l}
            </div>
            <div
              className={cn(
                'mono mb-2 text-lg font-medium',
                c.tone === 'up'
                  ? 'text-[#22C55E]'
                  : c.tone === 'down'
                    ? 'text-[#EF4444]'
                    : 'text-[#F5F5F5]'
              )}
            >
              {c.v}
            </div>
            {c.pill && c.sub ? (
              <span
                className={cn(
                  'mono rounded-full px-1.5 py-0.5 text-[11px]',
                  c.tone === 'up'
                    ? 'bg-[rgba(34,197,94,0.12)] text-[#22C55E]'
                    : 'bg-[rgba(239,68,68,0.12)] text-[#EF4444]'
                )}
              >
                {c.sub}
              </span>
            ) : c.sub ? (
              <div className="text-[10px] text-[#6E6E6E]">{c.sub}</div>
            ) : null}
            {c.bar != null && (
              <div className="mt-2 h-1 overflow-hidden rounded-sm bg-[#1C1C1C]">
                <div
                  className="h-full"
                  style={{ width: `${c.bar}%`, background: c.barColor }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Performance */}
      <div className="flex flex-col gap-3">
        {(tearsheet?.enough_history || (tearsheet?.equity_series?.length ?? 0) > 1) && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              {
                l: 'Sharpe',
                v:
                  tearsheet?.metrics?.sharpe != null
                    ? Number(tearsheet.metrics.sharpe).toFixed(2)
                    : '—',
              },
              {
                l: 'Max DD',
                v:
                  tearsheet?.metrics?.max_drawdown != null
                    ? `${(Number(tearsheet.metrics.max_drawdown) * 100).toFixed(1)}%`
                    : '—',
              },
              {
                l: 'Vol',
                v:
                  tearsheet?.metrics?.volatility != null
                    ? `${(Number(tearsheet.metrics.volatility) * 100).toFixed(1)}%`
                    : '—',
              },
              {
                l: 'CAGR',
                v:
                  tearsheet?.metrics?.cagr != null
                    ? `${(Number(tearsheet.metrics.cagr) * 100).toFixed(1)}%`
                    : '—',
              },
            ].map((m) => (
              <div
                key={m.l}
                className="rounded-xl border border-[#242424] bg-[#141414] px-3 py-2.5"
              >
                <div className="text-[10px] uppercase tracking-[0.02em] text-[#6E6E6E]">{m.l}</div>
                <div className="mono mt-0.5 text-[15px] text-[#F5F5F5]">{m.v}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-4 overflow-hidden rounded-xl border border-[#242424] bg-[#141414] p-4 md:h-[260px] md:flex-row md:items-stretch">
          <div className="relative min-h-[200px] min-w-0 flex-[3] md:min-h-0">
            <PerformanceChart
              start={portfolio.initialCash}
              end={portfolio.totalValue}
              up={plUp}
              rangeLabel={range}
              equitySeries={tearsheet?.equity_series}
            />
          </div>
          <div className="flex flex-col justify-center gap-1.5 border-[#242424] md:flex-1 md:border-l md:pl-4">
            <div className={cn('mono text-xl', plUp ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
              {plUp ? '+' : ''}
              {formatPrice(portfolio.plTotal)}
            </div>
            <div className={cn('mono text-[13px]', plUp ? 'text-[#22C55E]' : 'text-[#EF4444]')}>
              {plUp ? '+' : ''}
              {portfolio.plPercent.toFixed(2)}% · {range}
            </div>
            <div className="mono text-[12px] text-[#A1A1A1]">
              {formatPrice(portfolio.initialCash)}
              <span className="font-sans text-[#6E6E6E]"> → </span>
              {formatPrice(portfolio.totalValue)}
            </div>
            <p className="mt-2 text-[10px] leading-4 text-[#6E6E6E]">
              {tearsheet?.enough_history
                ? 'Risk metrics from paper trade history (QuantStats estimate).'
                : tearsheet?.message ||
                  'Chart is an estimate until you have enough paper trade history.'}
            </p>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="min-w-0 space-y-5">
          {/* Allocation */}
          <div className="rounded-xl border border-[#242424] bg-[#141414] p-5 md:p-6">
            <h2 className="mb-5 text-[12px] uppercase tracking-[0.02em] text-[#6E6E6E]">
              Allocation
            </h2>
            {donutSectors.length ? (
              <SectorsDonut
                symbol={formatPrice(portfolio.totalValue)}
                caption="Total value"
                sectors={donutSectors}
                className="min-h-[200px]"
              />
            ) : (
              <EmptyState
                title="No allocation yet"
                description="Use the trade ticket to buy your first paper shares."
                className="py-8"
              />
            )}
          </div>

          {/* Holdings */}
          <div className="overflow-hidden rounded-xl border border-[#242424] bg-[#141414]">
            <div className="border-b border-[#242424] px-4 py-3.5">
              <h2 className="text-[12px] uppercase tracking-[0.02em] text-[#6E6E6E]">
                Holdings
              </h2>
            </div>
            {portfolio.holdings.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No open positions"
                  description="Use the trade ticket to buy your first paper shares."
                />
              </div>
            ) : (
              <Accordion
                type="single"
                collapsible
                value={expanded ?? undefined}
                onValueChange={(v) => setExpanded(v || null)}
              >
                <div className="hidden grid-cols-[1.6fr_0.7fr_0.9fr_0.9fr_1fr_1fr_1fr_1fr] gap-2 border-b border-[#1C1C1C] px-4 py-2 text-[10px] uppercase tracking-wide text-[#6E6E6E] md:grid">
                  <span>Symbol</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Avg</span>
                  <span className="text-right">Last</span>
                  <span className="text-right">Value</span>
                  <span className="text-right">Day %</span>
                  <span className="text-right">Total %</span>
                  <span className="text-right">Weight</span>
                </div>
                {portfolio.holdings.map((h) => {
                  const price = h.price ?? h.avgCost;
                  const plPct =
                    h.avgCost > 0 ? ((price - h.avgCost) / h.avgCost) * 100 : 0;
                  const weight =
                    portfolio.totalValue > 0
                      ? ((h.value ?? 0) / portfolio.totalValue) * 100
                      : 0;
                  const over = weight / 100 > CAPITAL_GUARD.maxSingleWeight;
                  const dayPct = h.changePercent ?? 0;
                  return (
                    <AccordionItem
                      key={h.symbol}
                      value={h.symbol}
                      className={cn(
                        'border-[#1C1C1C]',
                        over && 'border-l-2 border-l-[#FDD458]'
                      )}
                    >
                      <AccordionTrigger className="h-14 px-4 py-0 hover:no-underline hover:bg-[#1C1C1C]/40">
                        <div className="grid w-full grid-cols-[1fr_auto] items-center gap-2 text-left md:grid-cols-[1.6fr_0.7fr_0.9fr_0.9fr_1fr_1fr_1fr_1fr]">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="mono flex size-7 flex-none items-center justify-center rounded-full bg-[rgba(253,212,88,0.12)] text-[10px] font-semibold text-[#F5F5F5]">
                              {h.symbol.slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="mono text-xs text-[#F5F5F5]">
                                  {h.symbol}
                                </span>
                                {over && (
                                  <AlertTriangle className="size-2.5 text-[#FDD458]" />
                                )}
                              </div>
                              <div className="truncate text-[10px] text-[#6E6E6E]">
                                {h.company}
                              </div>
                            </div>
                          </div>
                          <span className="mono hidden text-right text-xs text-[#F5F5F5] md:block">
                            {h.quantity}
                          </span>
                          <span className="mono hidden text-right text-xs text-[#A1A1A1] md:block">
                            {formatPrice(h.avgCost)}
                          </span>
                          <span className="mono hidden text-right text-xs text-[#F5F5F5] md:block">
                            {formatPrice(price)}
                          </span>
                          <span className="mono text-right text-xs text-[#F5F5F5]">
                            {formatPrice(h.value ?? 0)}
                          </span>
                          <span
                            className={cn(
                              'mono hidden text-right text-xs md:block',
                              dayPct >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
                            )}
                          >
                            {dayPct >= 0 ? '+' : ''}
                            {dayPct.toFixed(2)}%
                          </span>
                          <span
                            className={cn(
                              'mono hidden text-right text-xs md:block',
                              plPct >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
                            )}
                          >
                            {plPct >= 0 ? '+' : ''}
                            {plPct.toFixed(1)}%
                          </span>
                          <div className="hidden flex-col items-end gap-0.5 md:flex">
                            <span
                              className={cn(
                                'mono text-[11px]',
                                over ? 'text-[#FDD458]' : 'text-[#22C55E]'
                              )}
                            >
                              {weight.toFixed(0)}%
                            </span>
                            <div className="h-[3px] w-[50px] overflow-hidden rounded-sm bg-[#1C1C1C]">
                              <div
                                className={cn(
                                  'h-full',
                                  over ? 'bg-[#FDD458]' : 'bg-[#22C55E]'
                                )}
                                style={{
                                  width: `${Math.min(100, (weight / 50) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="border-b border-[#1C1C1C] bg-[#0A0A0A] px-4 pb-3.5 pl-[52px]">
                        <div className="mb-2 text-[11px] text-[#6E6E6E]">Since purchase</div>
                        <div
                          className={cn(
                            'mono mb-2 text-xs',
                            plPct >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
                          )}
                        >
                          {plPct >= 0 ? '+' : ''}
                          {formatPrice(h.pl ?? (price - h.avgCost) * h.quantity)} (
                          {plPct >= 0 ? '+' : ''}
                          {plPct.toFixed(1)}%) from entry
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="yellow-btn h-8 text-xs"
                            onClick={() => {
                              setSymbol(h.symbol);
                              setSide('buy');
                              setQuantity(1);
                            }}
                          >
                            Buy more
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 border-[#2E2E2E] text-xs"
                            onClick={() => {
                              setSymbol(h.symbol);
                              setSide('sell');
                              setQuantity(Math.min(h.quantity, 1));
                            }}
                          >
                            Sell
                          </Button>
                          <Link
                            href={`/stocks/${h.symbol}`}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#2E2E2E] px-3 text-xs text-[#A1A1A1] hover:text-[#FDD458]"
                          >
                            Chart <ExternalLink className="size-3" />
                          </Link>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>

          {/* Recent trades */}
          <div className="overflow-hidden rounded-xl border border-[#242424] bg-[#141414]">
            <div className="flex items-center justify-between border-b border-[#242424] px-4 py-3.5">
              <h2 className="text-[12px] uppercase tracking-[0.02em] text-[#6E6E6E]">
                Recent trades
              </h2>
              <Link
                href="/portfolio/history"
                className="text-xs text-[#FDD458] hover:underline"
              >
                See full history →
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No trades yet"
                  description="Filled paper trades will show up here."
                  className="py-6"
                />
              </div>
            ) : (
              <ul>
                {recent.slice(0, 5).map((t) => (
                  <li
                    key={t.id}
                    className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] items-center gap-2 border-b border-[#1C1C1C] px-4 py-2.5 last:border-b-0"
                  >
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase',
                        t.side === 'buy'
                          ? 'bg-[#FDD458] text-[#0A0A0A]'
                          : 'border border-[#EF4444] bg-transparent text-[#EF4444]'
                      )}
                    >
                      {t.side}
                    </span>
                    <span className="mono text-xs text-[#F5F5F5]">{t.symbol}</span>
                    <span className="mono text-xs text-[#A1A1A1]">
                      {t.quantity} @ {formatPrice(t.price)}
                    </span>
                    <span className="mono text-xs text-[#F5F5F5]">
                      {formatPrice(t.total)}
                    </span>
                    <span className="mono text-right text-[11px] text-[#6E6E6E]">
                      {timeAgo(t.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right rail */}
        <div className="sticky top-6 space-y-4 self-start">
          {/* Trade ticket — screenshot text + UI */}
          <div className="flex flex-col gap-3 rounded-xl border border-[#242424] bg-[#141414] p-4">
            <h2 className="text-[12px] uppercase tracking-[0.02em] text-[#6E6E6E]">
              Trade ticket
            </h2>

            <div className="flex rounded-lg bg-[#0A0A0A] p-1">
              <button
                type="button"
                onClick={() => setSide('buy')}
                className={cn(
                  'flex-1 rounded-md py-2 text-[13px] font-semibold transition',
                  side === 'buy'
                    ? 'bg-[#FDD458] text-[#0A0A0A]'
                    : 'text-[#A1A1A1] hover:text-[#F5F5F5]'
                )}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setSide('sell')}
                className={cn(
                  'flex-1 rounded-md py-2 text-[13px] font-semibold transition',
                  side === 'sell'
                    ? 'bg-[#EF4444] text-white'
                    : 'text-[#A1A1A1] hover:text-[#F5F5F5]'
                )}
              >
                Sell
              </button>
            </div>

            <div className="flex items-center gap-2.5 rounded-lg border border-[#242424] bg-[#0A0A0A] px-3 py-2.5">
              <div className="mono flex size-8 flex-none items-center justify-center rounded-full bg-[rgba(253,212,88,0.12)] text-[11px] font-semibold text-[#F5F5F5]">
                {(symbol || '—').slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <Input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  className="form-input h-7 border-0 bg-transparent px-0 mono text-[14px] font-semibold text-[#F5F5F5] shadow-none focus-visible:ring-0"
                  placeholder="AAPL"
                />
                <div className="truncate text-[12px] text-[#6E6E6E]">
                  {selectedHolding?.company ||
                    (symbol ? `${symbol.toUpperCase()} Inc.` : 'Select a symbol')}
                </div>
              </div>
            </div>

            <div>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="form-input mono h-12 border-[#242424] bg-[#0A0A0A] text-right text-2xl font-medium text-[#F5F5F5]"
              />
              <div className="mt-1.5 text-[11px] text-[#6E6E6E]">
                Max: {maxShares} shares
                {estPrice > 0 ? ` at ${formatPrice(estPrice)}` : ''}
              </div>
            </div>

            {estPrice > 0 && (
              <div className="rounded-lg bg-[#0A0A0A] px-3 py-2.5 text-[12px] leading-relaxed text-[#A1A1A1]">
                {side === 'buy' ? 'Buying' : 'Selling'}{' '}
                <span className="mono font-medium text-[#F5F5F5]">{quantity}</span>{' '}
                {symbol.toUpperCase()} @{' '}
                <span className="mono font-medium text-[#F5F5F5]">{formatPrice(estPrice)}</span>
                {' = '}
                <span className="mono font-medium text-[#F5F5F5]">{formatPrice(estTotal)}</span>
                {' · '}
                Cash after:{' '}
                <span className="mono font-medium text-[#F5F5F5]">
                  {formatPrice(Math.max(0, cashAfter))}
                </span>
              </div>
            )}

            {(guardHit || tradeTooLarge) && (
              <div className="rounded-lg border border-[rgba(253,212,88,0.45)] bg-[rgba(253,212,88,0.08)] p-3">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#FDD458]" />
                  <div className="min-w-0 text-[12px] leading-relaxed text-[#F5F5F5]">
                    {tradeTooLarge
                      ? `Trade size ${formatPrice(estTotal)} exceeds your ${formatPrice(CAPITAL_GUARD.maxTradeSize)} max trade limit.`
                      : `This would put ${projectedWeight.toFixed(0)}% of your portfolio in ${symbol.toUpperCase()}. Your Capital Guard limit is ${(CAPITAL_GUARD.maxSingleWeight * 100).toFixed(0)}%.`}
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-3 pl-6">
                  <button
                    type="button"
                    className="rounded-md border border-[#2E2E2E] bg-[#0A0A0A] px-2.5 py-1 text-[11px] font-medium text-[#F5F5F5] hover:border-[#FDD458]/40"
                    onClick={() =>
                      setQuantity(
                        Math.max(
                          1,
                          Math.floor(
                            ((CAPITAL_GUARD.maxSingleWeight * portfolio.totalValue -
                              (selectedHolding?.value ?? 0)) /
                              (estPrice || 1))
                          )
                        )
                      )
                    }
                  >
                    Adjust
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-[#6E6E6E] hover:text-[#A1A1A1]"
                    onClick={() => {
                      setOverrideGuard(true);
                      runTrade(true);
                    }}
                  >
                    Override & continue
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              className="text-left text-[12px] text-[#A1A1A1] hover:text-[#FDD458]"
              onClick={() => setJournalOpen((o) => !o)}
            >
              {journalOpen ? '− Hide journal note' : '+ Add journal note (optional)'}
            </button>
            {journalOpen && (
              <textarea
                value={journalNote}
                onChange={(e) => setJournalNote(e.target.value.slice(0, 240))}
                placeholder="Why are you making this trade?"
                maxLength={240}
                rows={3}
                className="w-full resize-y rounded-lg border border-[#242424] bg-[#0A0A0A] px-2.5 py-2.5 text-xs text-[#F5F5F5] placeholder:text-[#6E6E6E] focus:border-[#FDD458]/50 focus:outline-none"
              />
            )}

            <Button
              type="button"
              disabled={!!pendingKind}
              aria-busy={pendingKind === 'trade'}
              onClick={() => runTrade()}
              className="h-11 w-full rounded-lg bg-[#FDD458] text-[13px] font-semibold text-[#0A0A0A] hover:bg-[#E8BA40]"
            >
              {pendingKind === 'trade' ? (
                <Loader2 className="mr-2 size-3.5 animate-spin" />
              ) : null}
              {pendingKind === 'trade'
                ? 'Placing trade…'
                : `${side === 'buy' ? 'Buy' : 'Sell'} ${quantity} ${symbol.toUpperCase() || '—'}${estPrice > 0 ? ` — ${formatPrice(estTotal)}` : ''}`}
            </Button>
          </div>

          {/* Risk overview */}
          <div className="flex flex-col gap-3 rounded-xl border border-[#242424] bg-[#141414] p-4">
            <h2 className="text-[12px] uppercase tracking-[0.02em] text-[#6E6E6E]">
              Risk overview
            </h2>
            {[
              {
                label: 'Concentration',
                value: `${largestWeight.toFixed(0)}%`,
                bar: Math.min(100, largestWeight * 2),
                barColor: largestWeight > 25 ? '#EF4444' : '#22C55E',
              },
              {
                label: 'Cash buffer',
                value: `${cashPct.toFixed(0)}%`,
                bar: Math.min(100, cashPct * 2),
                barColor: '#FDD458',
              },
              {
                label: 'Largest position',
                value: largest?.symbol ?? '—',
                bar: null as number | null,
                barColor: '',
              },
              {
                label: 'Positions',
                value: String(portfolio.holdings.length),
                bar: null,
                barColor: '',
              },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="text-xs text-[#A1A1A1]">{r.label}</span>
                <div className="flex items-center gap-2">
                  <span className="mono text-xs text-[#F5F5F5]">{r.value}</span>
                  {r.bar != null && (
                    <div className="h-1 w-[50px] overflow-hidden rounded-sm bg-[#1C1C1C]">
                      <div
                        className="h-full"
                        style={{ width: `${r.bar}%`, background: r.barColor }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Capital guard */}
          <div className="flex flex-col gap-3 rounded-xl border border-[#242424] bg-[#141414] p-4">
            <h2 className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.02em] text-[#6E6E6E]">
              <Shield className="size-3.5 text-[#FDD458]" />
              Capital guard
            </h2>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <span
                  className={cn(
                    'size-2 flex-none rounded-full',
                    largestWeight > CAPITAL_GUARD.maxSingleWeight * 100
                      ? 'bg-[#EF4444]'
                      : 'bg-[#22C55E]'
                  )}
                />
                <span className="flex-1 text-xs text-[#F5F5F5]">Max % in one name</span>
                <span className="mono text-xs text-[#A1A1A1]">
                  {(CAPITAL_GUARD.maxSingleWeight * 100).toFixed(0)}%
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={cn(
                    'size-2 flex-none rounded-full',
                    cashPct < CAPITAL_GUARD.minCashReserve * 100
                      ? 'bg-[#EF4444]'
                      : 'bg-[#22C55E]'
                  )}
                />
                <span className="flex-1 text-xs text-[#F5F5F5]">Min cash reserve</span>
                <span className="mono text-xs text-[#A1A1A1]">
                  {(CAPITAL_GUARD.minCashReserve * 100).toFixed(0)}%
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2 flex-none rounded-full bg-[#22C55E]" />
                <span className="flex-1 text-xs text-[#F5F5F5]">Max trade size</span>
                <span className="mono text-xs text-[#A1A1A1]">
                  {formatPrice(CAPITAL_GUARD.maxTradeSize)}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* AI Portfolio Review */}
      <div className="rounded-xl border border-[#242424] border-l-2 border-l-[#FDD458] bg-[#141414] p-5 shadow-[0_0_40px_-26px_rgba(249,115,22,0.4)]">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.02em] text-[#6E6E6E]">
            <Sparkles className="size-4 text-[#FDD458]" />
            AI portfolio review
          </h2>
          <Button
            type="button"
            size="sm"
            disabled={!!pendingKind}
            onClick={requestAiReview}
            className="h-8 gap-1.5 border border-[#2E2E2E] bg-transparent px-2.5 text-xs text-[#F5F5F5] hover:bg-[#1C1C1C]"
          >
            {pendingKind === 'analyze' ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            Analyze now
          </Button>
        </div>

        {!aiReview ? (
          <p className="text-sm text-[#6E6E6E]">
            Run Analyze for concentration, risk factors, P/L attribution, and Capital Guard
            callouts — grounded in your live paper holdings.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[#6E6E6E]">
                  Health score
                </div>
                <div className="mono mt-1 text-3xl font-medium text-[#22C55E]">
                  {healthScore != null ? `${healthScore}/100` : '—'}
                </div>
                {healthScore != null && (
                  <>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1C1C1C]">
                      <div
                        className="h-full rounded-full bg-[#22C55E]"
                        style={{ width: `${healthScore}%` }}
                      />
                    </div>
                    <span className="mt-2 inline-block rounded-full bg-[rgba(34,197,94,0.15)] px-2 py-0.5 text-[10px] font-medium text-[#22C55E]">
                      {healthScore >= 70 ? 'Balanced' : healthScore >= 40 ? 'Watch' : 'Elevated'}
                    </span>
                  </>
                )}
                {aiReview.confidence != null && (
                  <ConfidenceMeter
                    className="mt-3"
                    value={
                      aiReview.confidence <= 1
                        ? aiReview.confidence * 100
                        : aiReview.confidence
                    }
                    label="Model confidence"
                  />
                )}
              </div>
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-wide text-[#6E6E6E]">
                  Concentration & risk
                </div>
                <div className="mono space-y-1.5 text-xs text-[#F5F5F5]">
                  {(snap?.hhi != null || snap?.effective_n != null) && (
                    <div>
                      {snap?.hhi != null && <>HHI {String(snap.hhi)}</>}
                      {snap?.hhi != null && snap?.effective_n != null && ' · '}
                      {snap?.effective_n != null && (
                        <>Effective N {String(snap.effective_n)}</>
                      )}
                    </div>
                  )}
                  {(snap?.top1_weight != null || snap?.cash_pct != null) && (
                    <div>
                      {snap?.top1_weight != null && <>Top-1 wt {String(snap.top1_weight)}</>}
                      {snap?.top1_weight != null && snap?.cash_pct != null && ' · '}
                      {snap?.cash_pct != null && <>Cash {String(snap.cash_pct)}</>}
                    </div>
                  )}
                  {(snap?.weighted_beta != null || snap?.port_vol != null) && (
                    <div>
                      {snap?.weighted_beta != null && (
                        <>Weighted β {String(snap.weighted_beta)}</>
                      )}
                      {snap?.weighted_beta != null && snap?.port_vol != null && ' · '}
                      {snap?.port_vol != null && <>Vol {String(snap.port_vol)}</>}
                    </div>
                  )}
                  {snap?.avg_corr != null && <div>Avg corr {String(snap.avg_corr)}</div>}
                  {!snap && (
                    <div className="text-[#6E6E6E]">Snapshot metrics unavailable</div>
                  )}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-wide text-[#6E6E6E]">
                  P/L attribution
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {portfolio.holdings.slice(0, 4).map((h) => {
                    const pct =
                      h.avgCost > 0
                        ? (((h.price ?? h.avgCost) - h.avgCost) / h.avgCost) * 100
                        : 0;
                    return (
                      <span
                        key={h.symbol}
                        className={cn(
                          'mono rounded-full px-2 py-0.5 text-[11px]',
                          pct >= 0
                            ? 'bg-[rgba(34,197,94,0.15)] text-[#22C55E]'
                            : 'bg-[rgba(239,68,68,0.15)] text-[#EF4444]'
                        )}
                      >
                        {h.symbol} {pct >= 0 ? '+' : ''}
                        {pct.toFixed(1)}%
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <p className="text-[13px] leading-5 text-[#F5F5F5]">{aiReview.summary}</p>

            {aiReview.rules_fired?.map((r) => (
              <div
                key={r.id}
                className="mb-2 flex items-start gap-2 border-l-2 border-[#FDD458] bg-[rgba(253,212,88,0.06)] px-2.5 py-2 text-xs text-[#F5F5F5]"
              >
                Rule fired: {r.tag} — {r.message}
              </div>
            ))}

            {largest && largestWeight > 25 && (
              <div className="text-xs text-[#A1A1A1]">
                Suggested: trim {largest.symbol} toward 25% and rotate into uncorrelated
                names.{' '}
                <button
                  type="button"
                  className="ml-1.5 rounded-md border border-[#2E2E2E] px-2 py-0.5 text-[11px] text-[#F5F5F5]"
                  onClick={() => {
                    setSymbol(largest.symbol);
                    setSide('sell');
                    setQuantity(1);
                  }}
                >
                  Prepare trade
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* This week */}
      {showWeek && (
        <div className="mb-10 rounded-xl border border-[#242424] border-l-2 border-l-[rgba(253,212,88,0.5)] bg-[#141414] p-[18px]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[12px] uppercase tracking-[0.02em] text-[#6E6E6E]">
              This week
            </h2>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setShowWeek(false)}
              className="text-[#6E6E6E] hover:text-[#A1A1A1]"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="mb-3.5 flex flex-wrap gap-6">
            <div>
              <span className="text-[11px] text-[#6E6E6E]">Trades made</span>
              <div className="mono text-[15px] text-[#F5F5F5]">{weekStats.trades}</div>
            </div>
            <div>
              <span className="text-[11px] text-[#6E6E6E]">Return</span>
              <div
                className={cn(
                  'mono text-[15px]',
                  dayUp ? 'text-[#22C55E]' : 'text-[#EF4444]'
                )}
              >
                {dayUp ? '+' : ''}
                {dayPlPercent.toFixed(1)}%
              </div>
            </div>
            <div>
              <span className="text-[11px] text-[#6E6E6E]">Realized</span>
              <div
                className={cn(
                  'mono text-[15px]',
                  weekStats.realized >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
                )}
              >
                {weekStats.realized >= 0 ? '+' : ''}
                {formatPrice(weekStats.realized)}
              </div>
            </div>
          </div>
          <input
            value={weekJournal}
            onChange={(e) => saveWeekJournal(e.target.value)}
            placeholder="What worked this week?"
            className="mb-2.5 w-full rounded-lg border border-[#242424] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#F5F5F5] placeholder:text-[#6E6E6E] focus:border-[#FDD458]/50 focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            {recent
              .filter((t) => t.note)
              .slice(0, 4)
              .map((t) => (
                <span
                  key={t.id}
                  className="rounded-full border border-[#242424] bg-[#0A0A0A] px-2.5 py-1 text-[11px] text-[#A1A1A1]"
                >
                  {t.side === 'buy' ? 'Bought' : 'Sold'} {t.symbol}
                  {t.note ? ` — "${t.note}"` : ''}
                </span>
              ))}
          </div>
        </div>
      )}
    </PageEnter>
  );
}
