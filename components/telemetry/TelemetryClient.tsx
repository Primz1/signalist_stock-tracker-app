'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Activity, Bell, Sparkles, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageEnter } from '@/components/ui/motion';
import { askSignal } from '@/lib/actions/telemetry.actions';
import { EVENT_TYPES, type PriceChangedEvent, type SignalKind, type TelemetryEvent } from '@/lib/events/types';
import { latestTicks, SIGNAL_KIND_LABELS, signalCounts, timelineEvents } from '@/lib/events/view';
import { useTelemetryStream, type StreamStatus } from '@/lib/hooks/useTelemetryStream';
import { cn, formatPrice } from '@/lib/utils';

type TelemetryClientProps = {
  symbols: string[];
  initialEvents: TelemetryEvent[];
  initialPrices: Record<string, PriceChangedEvent>;
};

type TypeFilter = 'all' | 'alerts' | 'signals' | 'ai';

const TYPE_FILTERS: { value: TypeFilter; label: string; type?: TelemetryEvent['type'] }[] = [
  { value: 'all', label: 'All' },
  { value: 'alerts', label: 'Alerts', type: EVENT_TYPES.ALERT_TRIGGERED },
  { value: 'signals', label: 'Signals', type: EVENT_TYPES.SIGNAL_UPDATED },
  { value: 'ai', label: 'AI notes', type: EVENT_TYPES.AI_REPORT_CREATED },
];

const STATUS_LABELS: Record<StreamStatus, string> = {
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
  polling: 'Updating every 30 seconds',
};

const STALE_AFTER_MS = 5 * 60 * 1000;

/** Ticks once a minute. Starts null so server and client render the same markup. */
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function formatAge(iso: string, now: number | null) {
  if (now === null) return '';
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

const toneClass = (value?: number) => {
  if (!value) return 'text-ink-2';
  return value > 0 ? 'text-up' : 'text-down';
};

function StatusBadge({ status, online }: { status: StreamStatus; online: boolean }) {
  const live = online && status === 'live';
  return (
    <span role="status" className="inline-flex items-center gap-2 text-[13px] text-ink-2">
      <span className={cn('size-1.5 rounded-full', live ? 'animate-pulse-soft bg-up' : 'bg-ink-3')} aria-hidden />
      {online ? STATUS_LABELS[status] : 'Offline'}
    </span>
  );
}

function LiveStrip({
  symbols,
  ticks,
}: {
  symbols: string[];
  ticks: Map<string, { price: number; changePercent?: number }>;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
      {symbols.slice(0, 12).map((symbol) => {
        const tick = ticks.get(symbol);
        return (
          <li key={symbol}>
            <Link
              href={`/stocks/${symbol}`}
              className="block rounded-lg border border-line bg-surface p-3 transition-colors duration-200 hover:border-line-strong hover:bg-surface-2"
            >
              <div className="truncate text-[13px] font-semibold text-ink">{symbol}</div>
              <div className="tabular mt-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-[15px] text-ink">{tick ? formatPrice(tick.price) : '—'}</span>
                {tick?.changePercent != null && (
                  <span className={cn('text-xs', toneClass(tick.changePercent))}>
                    {tick.changePercent > 0 ? '+' : ''}
                    {tick.changePercent.toFixed(2)}%
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function describeEvent(event: TelemetryEvent): { icon: LucideIcon; title: string; detail: string; tone?: string } {
  const payload = event.payload as Record<string, string>;
  if (event.type === EVENT_TYPES.ALERT_TRIGGERED) {
    return { icon: Bell, title: payload.message, detail: payload.company };
  }
  if (event.type === EVENT_TYPES.AI_REPORT_CREATED) {
    return { icon: Sparkles, title: 'AI note', detail: payload.summary };
  }
  if (event.type === EVENT_TYPES.SIGNAL_UPDATED) {
    const signal = event.payload as { title: string; direction: string; status: string; strength: number; confidence: number; note: string };
    const up = signal.direction.includes('bullish');
    const down = signal.direction.includes('bearish');
    return {
      icon: up ? TrendingUp : down ? TrendingDown : Activity,
      title: signal.title,
      detail: `${signal.note}. Strength ${signal.strength}, confidence ${signal.confidence}.`,
      tone: up ? 'text-up' : down ? 'text-down' : undefined,
    };
  }
  const up = payload.direction === 'up';
  return {
    icon: up ? TrendingUp : TrendingDown,
    title: payload.label,
    detail: payload.detail,
    tone: up ? 'text-up' : 'text-down',
  };
}

function Timeline({ events, now }: { events: TelemetryEvent[]; now: number | null }) {
  if (!events.length) {
    return (
      <EmptyState
        icon={Activity}
        title="Nothing here yet"
        description="Alerts and signals appear here as they happen. Signals need a few readings first, so a new symbol can take a few hours to show any."
      />
    );
  }

  return (
    <ol className="divide-y divide-line rounded-lg border border-line bg-surface">
      {events.map((event) => {
        const { icon: Icon, title, detail, tone } = describeEvent(event);
        return (
          <li key={event.id} className="flex gap-3 p-4">
            <Icon className={cn('mt-0.5 size-4 flex-none', tone ?? 'text-ink-2')} strokeWidth={1.5} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-sm font-semibold text-ink">
                  {event.symbol && (
                    <Link href={`/stocks/${event.symbol}`} className="mr-2 hover:underline">
                      {event.symbol}
                    </Link>
                  )}
                  <span className="font-normal text-ink-2">{title}</span>
                </p>
                <time dateTime={event.createdAt} className="tabular flex-none text-xs text-ink-3">
                  {formatAge(event.createdAt, now)}
                </time>
              </div>
              <p className="mt-1 text-sm leading-normal text-ink-2 [overflow-wrap:anywhere]">{detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function WhatChanged({ events, symbols, selected }: { events: TelemetryEvent[]; symbols: string[]; selected: string }) {
  const [pending, startTransition] = useTransition();
  const [answer, setAnswer] = useState<{ symbol: string; summary: string } | null>(null);

  const symbol = selected === 'all' ? symbols[0] : selected;
  const latest = events.find((event) => event.type === EVENT_TYPES.AI_REPORT_CREATED && event.symbol === symbol);
  const summary =
    answer?.symbol === symbol ? answer.summary : (latest?.payload as { summary?: string } | undefined)?.summary;

  const ask = () => {
    startTransition(async () => {
      const res = await askSignal(symbol);
      if (res.success) setAnswer({ symbol, summary: res.summary });
      else toast.error(res.message);
    });
  };

  return (
    <section aria-labelledby="what-changed" className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="what-changed" className="section-title">
          What changed in {symbol}
        </h2>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={ask}>
          {pending ? 'Asking…' : 'Ask AI'}
        </Button>
      </div>
      <p className="mt-3 text-sm leading-normal text-ink-2 [overflow-wrap:anywhere]">
        {summary ?? 'No AI note yet. One appears after a signal fires, or ask for one now.'}
      </p>
      <p className="mt-3 text-xs text-ink-3">Explains the signals above. Not investment advice.</p>
    </section>
  );
}

function SignalHeatmap({ events }: { events: TelemetryEvent[] }) {
  const counts = useMemo(() => signalCounts(events), [events]);
  const kinds = Object.keys(SIGNAL_KIND_LABELS) as SignalKind[];
  const rows = Array.from(counts.entries()).slice(0, 8);
  if (!rows.length) return null;

  const max = Math.max(...rows.flatMap(([, row]) => Object.values(row)));

  return (
    <section aria-labelledby="signal-map" className="rounded-lg border border-line bg-surface p-4">
      <h2 id="signal-map" className="section-title">
        Signal map
      </h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[320px] border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th scope="col" className="sr-only">
                Symbol
              </th>
              {kinds.map((kind) => (
                <th key={kind} scope="col" className="pb-1 font-normal text-ink-3">
                  {SIGNAL_KIND_LABELS[kind]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([symbol, row]) => (
              <tr key={symbol}>
                <th scope="row" className="pr-2 text-left font-semibold text-ink">
                  {symbol}
                </th>
                {kinds.map((kind) => {
                  const count = row[kind] ?? 0;
                  return (
                    <td
                      key={kind}
                      className="tabular h-8 rounded text-center text-ink"
                      style={{
                        background: count
                          ? `color-mix(in oklch, var(--sg-signal) ${20 + (count / max) * 50}%, transparent)`
                          : 'var(--sg-surface-2)',
                      }}
                    >
                      {count || ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function TelemetryClient({ symbols, initialEvents, initialPrices }: TelemetryClientProps) {
  const { events, status, online } = useTelemetryStream(initialEvents);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [symbolFilter, setSymbolFilter] = useState('all');
  const now = useNow();

  const ticks = useMemo(() => {
    const merged = new Map(Object.entries(initialPrices));
    latestTicks(events).forEach((tick, symbol) => merged.set(symbol, { ...merged.get(symbol)!, ...tick }));
    return merged;
  }, [events, initialPrices]);

  const newestTick = Object.values(initialPrices)
    .map((tick) => tick.timestamp)
    .concat(events.filter((e) => e.type === EVENT_TYPES.PRICE_CHANGED).map((e) => e.createdAt))
    .sort()
    .at(-1);
  const stale = now !== null && newestTick !== undefined && now - new Date(newestTick).getTime() > STALE_AFTER_MS;

  const timeline = useMemo(() => {
    const type = TYPE_FILTERS.find((filter) => filter.value === typeFilter)?.type;
    return timelineEvents(events).filter(
      (event) => (!type || event.type === type) && (symbolFilter === 'all' || event.symbol === symbolFilter)
    );
  }, [events, typeFilter, symbolFilter]);

  if (!symbols.length) {
    return (
      <PageEnter className="space-y-6">
        <h1 className="page-title">Signals</h1>
        <EmptyState
          icon={Activity}
          title="Follow a symbol to see signals"
          description="Add a stock to your watchlist, hold it in your paper portfolio, or set an alert. Its price, signals and AI notes then show up here."
          actionLabel="Open watchlist"
          actionHref="/watchlist"
        />
      </PageEnter>
    );
  }

  return (
    <PageEnter className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="page-title">Signals</h1>
        <StatusBadge status={status} online={online} />
      </header>

      {(stale || !newestTick) && (
        <p className="text-[13px] text-ink-3">
          {newestTick
            ? `Prices last updated ${formatAge(newestTick, now).toLowerCase()}. Stocks stop updating while the market is closed.`
            : 'Waiting for the first price update.'}
        </p>
      )}

      <LiveStrip symbols={symbols} ticks={ticks} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section aria-labelledby="timeline" className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="timeline" className="section-title">
              Timeline
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {TYPE_FILTERS.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  size="sm"
                  variant={typeFilter === filter.value ? 'default' : 'ghost'}
                  aria-pressed={typeFilter === filter.value}
                  onClick={() => setTypeFilter(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
              <select
                aria-label="Filter by symbol"
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value)}
                className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-ink"
              >
                <option value="all">All symbols</option>
                {symbols.map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Timeline events={timeline} now={now} />
        </section>

        <div className="min-w-0 space-y-6">
          <WhatChanged events={events} symbols={symbols} selected={symbolFilter} />
          <SignalHeatmap events={events} />
        </div>
      </div>
    </PageEnter>
  );
}
