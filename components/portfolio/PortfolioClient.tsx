'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { executeTrade, getPortfolioAiReview } from '@/lib/actions/portfolio.actions';
import { cn, formatPrice } from '@/lib/utils';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  ChevronDown,
  ExternalLink,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';

type Holding = {
  symbol: string;
  company: string;
  quantity: number;
  avgCost: number;
  price?: number;
  value?: number;
  pl?: number;
};

type PortfolioData = {
  cash: number;
  initialCash: number;
  holdings: Holding[];
  totalValue: number;
  plTotal: number;
  plPercent: number;
};

const COLORS = ['#FDD458', '#60A5FA', '#22C55E', '#EF4444', '#A78BFA', '#FB923C'];

export default function PortfolioClient({ initial }: { initial: PortfolioData }) {
  const [portfolio, setPortfolio] = useState(initial);
  const [symbol, setSymbol] = useState('AAPL');
  const [quantity, setQuantity] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sellQty, setSellQty] = useState<Record<string, number>>({});
  const [aiReview, setAiReview] = useState<{
    summary: string;
    snapshot?: Record<string, any>;
    rules_fired?: { id: string; tag: string; message: string }[];
    narrative?: Record<string, any>;
  } | null>(null);
  const [showTrade, setShowTrade] = useState(false);
  const [, startTransition] = useTransition();
  const [pendingKind, setPendingKind] = useState<'trade' | 'analyze' | null>(null);

  const invested = useMemo(
    () => portfolio.holdings.reduce((sum, h) => sum + (h.value ?? 0), 0),
    [portfolio.holdings]
  );

  const allocation = useMemo(
    () =>
      [
        { name: 'Cash', value: portfolio.cash },
        ...portfolio.holdings.map((h) => ({ name: h.symbol, value: h.value ?? 0 })),
      ].filter((a) => a.value > 0),
    [portfolio]
  );

  const runTrade = (
    side: 'buy' | 'sell',
    tradeSymbol: string,
    tradeQty: number,
    company?: string
  ) => {
    if (!tradeSymbol || tradeQty <= 0) {
      toast.error('Enter a valid quantity');
      return;
    }
    setPendingKind('trade');
    startTransition(async () => {
      try {
        const res = await executeTrade({
          symbol: tradeSymbol,
          company: company || tradeSymbol,
          side,
          quantity: tradeQty,
        });
        if (!res.success) {
          toast.error(res.message);
          return;
        }
        setPortfolio(res.data as PortfolioData);
        toast.success(
          `${side === 'buy' ? 'Bought' : 'Sold'} ${tradeQty} ${tradeSymbol.toUpperCase()}`
        );
        if (side === 'sell') {
          const remaining = (res.data as PortfolioData).holdings.find(
            (h) => h.symbol === tradeSymbol.toUpperCase()
          );
          if (!remaining) setExpanded(null);
        }
      } finally {
        setPendingKind(null);
      }
    });
  };

  const exitPosition = (h: Holding) => {
    runTrade('sell', h.symbol, h.quantity, h.company);
  };

  const requestAiReview = () => {
    setPendingKind('analyze');
    startTransition(async () => {
      try {
        const res = await getPortfolioAiReview();
        if (!res.success) {
          toast.error(res.message);
          return;
        }
        setAiReview({
          summary: res.data.summary,
          snapshot: res.data.snapshot as Record<string, any> | undefined,
          rules_fired: res.data.rules_fired as
            | { id: string; tag: string; message: string }[]
            | undefined,
          narrative: res.data.narrative as Record<string, any> | undefined,
        });
      } finally {
        setPendingKind(null);
      }
    });
  };

  const plUp = portfolio.plTotal >= 0;

  return (
    <div className="mx-auto max-w-[1100px]">
      {/* One continuous surface */}
      <div className="overflow-hidden rounded-2xl border border-[#242424] bg-[#141414]">
        {/* Header / summary */}
        <div className="relative border-b border-[#242424] px-5 py-6 md:px-8 md:py-7">
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{
              background:
                'radial-gradient(500px circle at 0% 0%, rgba(253,212,88,0.08), transparent 55%)',
            }}
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-[#6E6E6E]">
                Paper portfolio
              </p>
              <h1 className="mono text-[34px] font-medium leading-none text-[#F5F5F5]">
                {formatPrice(portfolio.totalValue)}
              </h1>
              <p
                className={cn(
                  'mono mt-2 text-[13px]',
                  plUp ? 'text-[#22C55E]' : 'text-[#EF4444]'
                )}
              >
                {plUp ? '+' : ''}
                {formatPrice(portfolio.plTotal)} ({plUp ? '+' : ''}
                {portfolio.plPercent.toFixed(2)}%) vs start
              </p>
            </div>

            <div className="flex flex-wrap gap-6 lg:gap-10">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[#6E6E6E]">Cash</div>
                <div className="mono mt-0.5 text-[15px] text-[#F5F5F5]">
                  {formatPrice(portfolio.cash)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[#6E6E6E]">Invested</div>
                <div className="mono mt-0.5 text-[15px] text-[#F5F5F5]">
                  {formatPrice(invested)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[#6E6E6E]">
                  Positions
                </div>
                <div className="mono mt-0.5 text-[15px] text-[#F5F5F5]">
                  {portfolio.holdings.length}
                </div>
              </div>
              <Link
                href="/portfolio/history"
                className="self-end text-[12px] text-[#A1A1A1] hover:text-[#FDD458]"
              >
                Trade history →
              </Link>
              <Button
                type="button"
                onClick={() => setShowTrade((s) => !s)}
                className="yellow-btn h-auto self-end px-4 py-2 text-xs"
              >
                {showTrade ? 'Close ticket' : 'New trade'}
              </Button>
            </div>
          </div>

          {/* Inline trade ticket */}
          {showTrade && (
            <div className="relative mt-6 flex flex-col gap-3 rounded-xl border border-[#2E2E2E] bg-[#0A0A0A]/80 p-4 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-[12px] text-[#A1A1A1]">Symbol</span>
                <Input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="AAPL"
                  className="form-input"
                />
              </label>
              <label className="flex w-full flex-col gap-1.5 sm:w-28">
                <span className="text-[12px] text-[#A1A1A1]">Qty</span>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                  className="form-input"
                />
              </label>
              <div className="flex gap-2 sm:pb-0.5">
                <Button
                  type="button"
                  disabled={!!pendingKind}
                  aria-busy={pendingKind === 'trade'}
                  onClick={() => runTrade('buy', symbol, quantity)}
                  className="yellow-btn h-auto flex-1 px-5 py-3 text-xs sm:flex-none"
                >
                  {pendingKind === 'trade' ? (
                    <Loader2 className="mr-1 size-3.5 animate-spin" />
                  ) : (
                    <Plus className="mr-1 size-3.5" />
                  )}
                  {pendingKind === 'trade' ? 'Buying…' : 'Buy'}
                </Button>
                <Button
                  type="button"
                  disabled={!!pendingKind}
                  aria-busy={pendingKind === 'trade'}
                  variant="outline"
                  onClick={() => runTrade('sell', symbol, quantity)}
                  className="h-auto flex-1 rounded-2xl border-[#2E2E2E] bg-transparent px-5 py-3 text-xs text-[#F5F5F5] hover:bg-[#1C1C1C] sm:flex-none"
                >
                  {pendingKind === 'trade' ? (
                    <Loader2 className="mr-1 size-3.5 animate-spin" />
                  ) : (
                    <Minus className="mr-1 size-3.5" />
                  )}
                  {pendingKind === 'trade' ? 'Selling…' : 'Sell'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Body: holdings + allocation side-by-side without separate cards */}
        <div className="grid lg:grid-cols-[1fr_240px]">
          <div className="min-w-0 border-b border-[#242424] lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between px-5 py-3.5 md:px-8">
              <h2 className="text-[13px] font-semibold text-[#F5F5F5]">Holdings</h2>
              <span className="text-[11px] text-[#6E6E6E]">Tap a row for details & exit</span>
            </div>

            {portfolio.holdings.length === 0 ? (
              <div className="px-5 py-14 text-center md:px-8">
                <p className="text-[14px] text-[#A1A1A1]">No open positions</p>
                <p className="mt-1 text-[12px] text-[#6E6E6E]">
                  Use New trade to buy your first paper shares.
                </p>
                <Button
                  type="button"
                  onClick={() => setShowTrade(true)}
                  className="yellow-btn mt-4 h-auto px-4 py-2 text-xs"
                >
                  Open trade ticket
                </Button>
              </div>
            ) : (
              <ul>
                {portfolio.holdings.map((h) => {
                  const up = (h.pl ?? 0) >= 0;
                  const price = h.price ?? h.avgCost;
                  const plPct =
                    h.avgCost > 0 ? ((price - h.avgCost) / h.avgCost) * 100 : 0;
                  const weight =
                    portfolio.totalValue > 0
                      ? ((h.value ?? 0) / portfolio.totalValue) * 100
                      : 0;
                  const isOpen = expanded === h.symbol;
                  const qtyForSell = sellQty[h.symbol] ?? Math.min(h.quantity, 1);

                  return (
                    <li key={h.symbol} className="border-t border-[#1C1C1C]">
                      <button
                        type="button"
                        onClick={() => {
                          setExpanded(isOpen ? null : h.symbol);
                          setSellQty((prev) => ({
                            ...prev,
                            [h.symbol]: prev[h.symbol] ?? Math.min(h.quantity, 1),
                          }));
                        }}
                        className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-[#1C1C1C]/35 md:px-8"
                      >
                        <div className="mono flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[rgba(253,212,88,0.12)] text-[11px] font-semibold text-[#F5F5F5]">
                          {h.symbol.slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="mono text-[14px] font-medium text-[#F5F5F5]">
                              {h.symbol}
                            </span>
                            <span className="truncate text-[12px] text-[#6E6E6E]">
                              {h.company || h.symbol}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#6E6E6E]">
                            {h.quantity} sh · {weight.toFixed(1)}% of portfolio
                          </div>
                        </div>
                        <div className="hidden text-right sm:block">
                          <div className="mono text-[13px] text-[#F5F5F5]">
                            {formatPrice(h.value ?? 0)}
                          </div>
                          <div
                            className={cn(
                              'mono text-[11px]',
                              up ? 'text-[#22C55E]' : 'text-[#EF4444]'
                            )}
                          >
                            {up ? '+' : ''}
                            {formatPrice(h.pl ?? 0)} ({up ? '+' : ''}
                            {plPct.toFixed(2)}%)
                          </div>
                        </div>
                        <ChevronDown
                          className={cn(
                            'size-4 flex-none text-[#6E6E6E] transition-transform',
                            isOpen && 'rotate-180'
                          )}
                        />
                      </button>

                      {isOpen && (
                        <div className="border-t border-[#1C1C1C] bg-[#0A0A0A]/50 px-5 py-4 md:px-8">
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <Detail label="Last" value={formatPrice(price)} />
                            <Detail label="Avg cost" value={formatPrice(h.avgCost)} />
                            <Detail label="Shares" value={String(h.quantity)} />
                            <Detail
                              label="Unrealized"
                              value={`${up ? '+' : ''}${formatPrice(h.pl ?? 0)}`}
                              tone={up ? 'up' : 'down'}
                            />
                          </div>

                          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <Link
                              href={`/stocks/${h.symbol}`}
                              className="inline-flex items-center gap-1.5 text-[12px] text-[#FDD458] hover:underline"
                            >
                              View chart & analysis
                              <ExternalLink className="size-3" />
                            </Link>

                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-1.5 rounded-lg border border-[#2E2E2E] bg-[#0A0A0A] px-2 py-1">
                                <button
                                  type="button"
                                  aria-label="Decrease sell qty"
                                  className="p-1 text-[#A1A1A1] hover:text-[#F5F5F5]"
                                  onClick={() =>
                                    setSellQty((prev) => ({
                                      ...prev,
                                      [h.symbol]: Math.max(1, (prev[h.symbol] ?? 1) - 1),
                                    }))
                                  }
                                >
                                  <Minus className="size-3.5" />
                                </button>
                                <Input
                                  type="number"
                                  min={1}
                                  max={h.quantity}
                                  value={qtyForSell}
                                  onChange={(e) =>
                                    setSellQty((prev) => ({
                                      ...prev,
                                      [h.symbol]: Math.min(
                                        h.quantity,
                                        Math.max(1, Number(e.target.value) || 1)
                                      ),
                                    }))
                                  }
                                  className="h-7 w-14 border-0 bg-transparent px-0 text-center font-mono text-[13px] text-[#F5F5F5] shadow-none focus-visible:ring-0"
                                />
                                <button
                                  type="button"
                                  aria-label="Increase sell qty"
                                  className="p-1 text-[#A1A1A1] hover:text-[#F5F5F5]"
                                  onClick={() =>
                                    setSellQty((prev) => ({
                                      ...prev,
                                      [h.symbol]: Math.min(
                                        h.quantity,
                                        (prev[h.symbol] ?? 1) + 1
                                      ),
                                    }))
                                  }
                                >
                                  <Plus className="size-3.5" />
                                </button>
                              </div>

                              <Button
                                type="button"
                                disabled={!!pendingKind}
                                aria-busy={pendingKind === 'trade'}
                                variant="outline"
                                onClick={() =>
                                  runTrade('sell', h.symbol, qtyForSell, h.company)
                                }
                                className="h-8 rounded-lg border-[#2E2E2E] bg-transparent px-3 text-[12px] text-[#F5F5F5] hover:bg-[#1C1C1C]"
                              >
                                {pendingKind === 'trade' ? (
                                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                                ) : null}
                                Sell {qtyForSell}
                              </Button>
                              <Button
                                type="button"
                                disabled={!!pendingKind}
                                aria-busy={pendingKind === 'trade'}
                                onClick={() => exitPosition(h)}
                                className="h-8 rounded-lg bg-[#EF4444] px-3 text-[12px] font-semibold text-white hover:bg-[#dc2626]"
                              >
                                {pendingKind === 'trade' ? (
                                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                                ) : (
                                  <X className="mr-1 size-3.5" />
                                )}
                                Exit all
                              </Button>
                              <Button
                                type="button"
                                disabled={!!pendingKind}
                                aria-busy={pendingKind === 'trade'}
                                onClick={() => runTrade('buy', h.symbol, 1, h.company)}
                                className="h-8 rounded-lg border border-[#2E2E2E] bg-transparent px-3 text-[12px] text-[#FDD458] hover:bg-[#1C1C1C]"
                              >
                                {pendingKind === 'trade' ? (
                                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                                ) : null}
                                +1 share
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Allocation rail — part of same panel */}
          <div className="flex flex-col px-5 py-4 md:px-6">
            <h2 className="mb-3 text-[13px] font-semibold text-[#F5F5F5]">Allocation</h2>
            {allocation.length === 0 ? (
              <p className="text-[12px] text-[#6E6E6E]">Nothing allocated yet.</p>
            ) : (
              <>
                <div className="mx-auto w-full max-w-[180px]">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={allocation}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={68}
                        stroke="none"
                      >
                        {allocation.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatPrice(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 space-y-2">
                  {allocation.map((a, i) => {
                    const pct =
                      portfolio.totalValue > 0
                        ? (a.value / portfolio.totalValue) * 100
                        : 0;
                    return (
                      <li
                        key={a.name}
                        className="flex items-center justify-between gap-2 text-[12px]"
                      >
                        <span className="flex items-center gap-2 text-[#A1A1A1]">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: COLORS[i % COLORS.length] }}
                          />
                          {a.name}
                        </span>
                        <span className="mono text-[#F5F5F5]">{pct.toFixed(0)}%</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>

        {/* AI strip — same surface, not a detached card */}
        <div className="border-t border-[#242424] px-5 py-4 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <Sparkles className="mt-0.5 size-3.5 flex-none text-[#FDD458]" strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <h2 className="text-[13px] font-semibold text-[#F5F5F5]">AI portfolio review</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[#A1A1A1]">
                  {aiReview?.summary ||
                    'Quant snapshot + rules first, then Gemini narration of concentration and risk.'}
                </p>

                {aiReview?.snapshot && (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-lg border border-[#242424] bg-[#0A0A0A]/50 p-2">
                        <div className="text-[10px] uppercase text-[#6E6E6E]">HHI</div>
                        <div className="mono text-[13px] text-[#F5F5F5]">
                          {Number(aiReview.snapshot.concentration?.hhi ?? 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#242424] bg-[#0A0A0A]/50 p-2">
                        <div className="text-[10px] uppercase text-[#6E6E6E]">Effective N</div>
                        <div className="mono text-[13px] text-[#F5F5F5]">
                          {Number(aiReview.snapshot.concentration?.effective_n ?? 0).toFixed(1)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#242424] bg-[#0A0A0A]/50 p-2">
                        <div className="text-[10px] uppercase text-[#6E6E6E]">Top-1 wt</div>
                        <div className="mono text-[13px] text-[#F5F5F5]">
                          {(Number(aiReview.snapshot.concentration?.top_1_weight ?? 0) * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#242424] bg-[#0A0A0A]/50 p-2">
                        <div className="text-[10px] uppercase text-[#6E6E6E]">Cash</div>
                        <div className="mono text-[13px] text-[#F5F5F5]">
                          {(Number(aiReview.snapshot.cash_pct ?? 0) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-[#242424] bg-[#0A0A0A]/50 p-2">
                        <div className="text-[10px] uppercase text-[#6E6E6E]">Weighted β</div>
                        <div className="mono text-[13px] text-[#F5F5F5]">
                          {aiReview.snapshot.risk?.weighted_beta != null
                            ? Number(aiReview.snapshot.risk.weighted_beta).toFixed(2)
                            : '—'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#242424] bg-[#0A0A0A]/50 p-2">
                        <div className="text-[10px] uppercase text-[#6E6E6E]">Port vol</div>
                        <div className="mono text-[13px] text-[#F5F5F5]">
                          {aiReview.snapshot.risk?.weighted_vol_20d != null
                            ? `${(Number(aiReview.snapshot.risk.weighted_vol_20d) * 100).toFixed(1)}%`
                            : '—'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#242424] bg-[#0A0A0A]/50 p-2">
                        <div className="text-[10px] uppercase text-[#6E6E6E]">Avg corr</div>
                        <div className="mono text-[13px] text-[#F5F5F5]">
                          {aiReview.snapshot.risk?.avg_pairwise_correlation != null
                            ? Number(aiReview.snapshot.risk.avg_pairwise_correlation).toFixed(2)
                            : '—'}
                        </div>
                      </div>
                    </div>

                    {(aiReview.snapshot.drawdown?.max_dd != null ||
                      aiReview.snapshot.sector_allocation?.largest_sector) && (
                      <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-[#A1A1A1]">
                        {aiReview.snapshot.drawdown?.max_dd != null && (
                          <span className="mono">
                            Max DD:{' '}
                            <span className="text-[#EF4444]">
                              {(Number(aiReview.snapshot.drawdown.max_dd) * 100).toFixed(1)}%
                            </span>
                          </span>
                        )}
                        {aiReview.snapshot.drawdown?.current_dd != null && (
                          <span className="mono">
                            Current DD:{' '}
                            {(Number(aiReview.snapshot.drawdown.current_dd) * 100).toFixed(1)}%
                          </span>
                        )}
                        {aiReview.snapshot.sector_allocation?.largest_sector && (
                          <span>
                            Largest sector:{' '}
                            {aiReview.snapshot.sector_allocation.largest_sector} (
                            {(
                              Number(aiReview.snapshot.sector_allocation.largest_sector_weight ?? 0) *
                              100
                            ).toFixed(0)}
                            %)
                          </span>
                        )}
                      </div>
                    )}

                    {Array.isArray(aiReview.snapshot.pl_attribution?.winners) &&
                      aiReview.snapshot.pl_attribution.winners.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-[10px] uppercase text-[#6E6E6E]">P/L attribution</div>
                          <div className="flex flex-wrap gap-2">
                            {aiReview.snapshot.pl_attribution.winners
                              .slice(0, 3)
                              .map((w: { symbol?: string; contribution_usd?: number }) => (
                                <span
                                  key={`w-${w.symbol}`}
                                  className="mono rounded border border-[#22C55E]/30 px-2 py-0.5 text-[11px] text-[#22C55E]"
                                >
                                  {w.symbol} +{formatPrice(Number(w.contribution_usd ?? 0))}
                                </span>
                              ))}
                            {(aiReview.snapshot.pl_attribution.losers || [])
                              .slice(0, 3)
                              .map((w: { symbol?: string; contribution_usd?: number }) => (
                                <span
                                  key={`l-${w.symbol}`}
                                  className="mono rounded border border-[#EF4444]/30 px-2 py-0.5 text-[11px] text-[#EF4444]"
                                >
                                  {w.symbol} {formatPrice(Number(w.contribution_usd ?? 0))}
                                </span>
                              ))}
                          </div>
                        </div>
                      )}
                  </>
                )}

                {aiReview?.rules_fired && aiReview.rules_fired.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {aiReview.rules_fired.map((r) => (
                      <li
                        key={r.id}
                        className="rounded-lg border border-[#242424] border-l-2 border-l-[#FDD458] bg-[#0A0A0A]/40 px-3 py-2 text-[12px] text-[#A1A1A1]"
                      >
                        <span className="mr-2 text-[10px] uppercase text-[#FDD458]">{r.tag}</span>
                        {r.message}
                      </li>
                    ))}
                  </ul>
                )}

                {aiReview?.narrative && (
                  <div className="mt-3 grid gap-2 text-[12px] text-[#A1A1A1] sm:grid-cols-2">
                    {['concentration_read', 'risk_read', 'attribution_read', 'drawdown_read', 'actions_read'].map(
                      (k) =>
                        aiReview.narrative?.[k] ? (
                          <div key={k} className="rounded-lg bg-[#0A0A0A]/50 p-2">
                            <div className="mb-1 text-[10px] uppercase text-[#6E6E6E]">
                              {k.replace('_read', '').replace('_', ' ')}
                            </div>
                            {String(aiReview.narrative[k])}
                          </div>
                        ) : null
                    )}
                  </div>
                )}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={!!pendingKind}
              aria-busy={pendingKind === 'analyze'}
              onClick={requestAiReview}
              className="yellow-btn h-auto shrink-0 px-3 py-1.5 text-xs"
            >
              {pendingKind === 'analyze' ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Analyzing…
                </>
              ) : (
                'Analyze'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'up' | 'down';
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[#6E6E6E]">{label}</div>
      <div
        className={cn(
          'mono mt-0.5 text-[13px] text-[#F5F5F5]',
          tone === 'up' && 'text-[#22C55E]',
          tone === 'down' && 'text-[#EF4444]'
        )}
      >
        {value}
      </div>
    </div>
  );
}
