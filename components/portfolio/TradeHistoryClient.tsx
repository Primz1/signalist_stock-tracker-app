'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  getTradeHistory,
  undoTrade,
  type TradeHistoryFilters,
  type TradeRow,
} from '@/lib/actions/portfolio.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatPrice } from '@/lib/utils';
import { toast } from 'sonner';
import { Download, Filter, Loader2, Undo2 } from 'lucide-react';
import { HistoryEmptyState } from '@/components/ui/empty-state';
import { PageEnter } from '@/components/ui/motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Summary = {
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  realizedPl: number;
  winRate: number | null;
  mostTraded: string | null;
};

const RANGES: { id: TradeHistoryFilters['range']; label: string }[] = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: 'ytd', label: 'YTD' },
  { id: 'all', label: 'All' },
];

export default function TradeHistoryClient() {
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [side, setSide] = useState<'all' | 'buy' | 'sell'>('all');
  const [range, setRange] = useState<TradeHistoryFilters['range']>('all');
  const [symbolQuery, setSymbolQuery] = useState('');
  const [noteQuery, setNoteQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const [hasLoaded, setHasLoaded] = useState(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      const symbols = symbolQuery
        .split(/[\s,]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const res = await getTradeHistory({
        side,
        range,
        symbols: symbols.length ? symbols : undefined,
        noteQuery: noteQuery || undefined,
      });
      if (!res.success) {
        toast.error(res.message);
        setHasLoaded(true);
        return;
      }
      setTrades(res.data.trades);
      setSummary(res.data.summary);
      setHasLoaded(true);
    });
  }, [side, range, symbolQuery, noteQuery]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = () => {
    const header = [
      'Date',
      'Side',
      'Symbol',
      'Qty',
      'Price',
      'Total',
      'Fees',
      'Note',
      'Realized P/L',
    ];
    const rows = trades.map((t) => [
      t.timestamp,
      t.side.toUpperCase(),
      t.symbol,
      String(t.quantity),
      String(t.price),
      String(t.total),
      String(t.fees),
      t.note ?? '',
      t.realizedPl != null ? String(t.realizedPl) : '',
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signalist-trades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onUndo = (id: string) => {
    setUndoingId(id);
    startTransition(async () => {
      try {
        const res = await undoTrade(id);
        if (!res.success) {
          toast.error(res.message);
          return;
        }
        toast.success('Trade undone');
        load();
      } finally {
        setUndoingId(null);
      }
    });
  };

  const caption = useMemo(() => {
    if (!summary) return 'Loading trades…';
    const parts = [
      `${summary.tradeCount} trades`,
      `${summary.buyCount} buys / ${summary.sellCount} sells`,
    ];
    if (summary.mostTraded) parts.push(`most traded ${summary.mostTraded}`);
    return parts.join(' · ');
  }, [summary]);

  return (
    <PageEnter className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Trade history</h1>
          <p className="page-lede">{caption}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-ink-2"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="mr-1.5 size-3.5" />
            Filter
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-ink-2"
            onClick={exportCsv}
            disabled={!trades.length}
          >
            <Download className="mr-1.5 size-3.5" />
            Export CSV
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/portfolio">Back to portfolio</Link>
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <Tabs
            value={side}
            onValueChange={(v) => setSide(v as 'all' | 'buy' | 'sell')}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="buy">Buys</TabsTrigger>
              <TabsTrigger value="sell">Sells</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                {RANGES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRange(r.id)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-xs',
                      range === r.id
                        ? 'border-signal bg-signal/10 text-signal'
                        : 'border-line-strong text-ink-2'
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={symbolQuery}
                  onChange={(e) => setSymbolQuery(e.target.value.toUpperCase())}
                  placeholder="Symbols (AAPL TSLA)"
                  className="form-input"
                />
                <Input
                  value={noteQuery}
                  onChange={(e) => setNoteQuery(e.target.value)}
                  placeholder="Search notes"
                  className="form-input"
                />
              </div>
          </div>
        </div>
      )}

      {isPending && !hasLoaded ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-busy="true" aria-label="Loading summary">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] rounded-lg" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
          <Mini label="Trades" value={String(summary.tradeCount)} />
          <Mini
            label="Realized P/L"
            value={formatPrice(summary.realizedPl)}
            tone={summary.realizedPl >= 0 ? 'up' : 'down'}
          />
          <Mini
            label="Win rate"
            value={summary.winRate == null ? '—' : `${(summary.winRate * 100).toFixed(0)}%`}
          />
          <Mini label="Most traded" value={summary.mostTraded ?? '—'} />
        </div>
      ) : null}

      {isPending && !hasLoaded ? (
        <div className="space-y-2 rounded-lg border border-line p-3" aria-busy="true" aria-label="Loading trades">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !trades.length && !isPending ? (
        <HistoryEmptyState />
      ) : (
        <div
          className={cn(
            'overflow-x-auto rounded-lg border border-line',
            isPending && 'opacity-60'
          )}
        >
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-line bg-surface text-[12px] text-ink-3">
              <tr>
                <th className="px-3 py-2.5 text-right font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Side</th>
                <th className="px-3 py-2.5 font-medium">Symbol</th>
                <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                <th className="px-3 py-2.5 text-right font-medium">Price</th>
                <th className="px-3 py-2.5 text-right font-medium">Total</th>
                <th className="px-3 py-2.5 text-right font-medium">Fees</th>
                <th className="px-3 py-2.5 text-right font-medium">Realized</th>
                <th className="px-3 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-b border-surface-2 last:border-0">
                  <td className="mono px-3 py-2.5 text-right text-ink-2">
                    {new Date(t.timestamp).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        'mono text-[13px] font-medium capitalize',
                        t.side === 'buy' ? 'text-signal' : 'text-ink-2'
                      )}
                    >
                      {t.side}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/stocks/${t.symbol}`}
                      className="mono font-medium text-ink hover:text-signal"
                    >
                      {t.symbol}
                    </Link>
                  </td>
                  <td className="mono px-3 py-2.5 text-right text-ink">{t.quantity}</td>
                  <td className="mono px-3 py-2.5 text-right text-ink">
                    {formatPrice(t.price)}
                  </td>
                  <td className="mono px-3 py-2.5 text-right text-ink">
                    {formatPrice(t.total)}
                  </td>
                  <td className="mono px-3 py-2.5 text-right text-ink-3">
                    {formatPrice(t.fees)}
                  </td>
                  <td
                    className={cn(
                      'mono px-3 py-2.5 text-right',
                      t.realizedPl == null
                        ? 'text-ink-3'
                        : t.realizedPl >= 0
                          ? 'text-up'
                          : 'text-down'
                    )}
                  >
                    {t.realizedPl == null ? '—' : formatPrice(t.realizedPl)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {t.canUndo && (
                      <button
                        type="button"
                        disabled={isPending}
                        aria-busy={undoingId === t.id}
                        onClick={() => onUndo(t.id)}
                        className="inline-flex items-center gap-1 text-ink-3 hover:text-signal disabled:opacity-50"
                        title="Undo within 5 min"
                      >
                        {undoingId === t.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Undo2 className="size-3.5" />
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageEnter>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'up' | 'down';
}) {
  return (
    <div className="bg-canvas px-4 py-3">
      <div className="text-[12px] text-ink-3">{label}</div>
      <div
        className={cn(
          'mono mt-1 text-[17px] text-ink',
          tone === 'up' && 'text-up',
          tone === 'down' && 'text-down'
        )}
      >
        {value}
      </div>
    </div>
  );
}
