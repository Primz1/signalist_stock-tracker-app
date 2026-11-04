'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/ui/empty-state';
import { PageEnter } from '@/components/ui/motion';
import { EVENT_TYPES, type TelemetryEvent } from '@/lib/events/types';
import { latestTicks } from '@/lib/events/view';
import { useTelemetryStream, type StreamStatus } from '@/lib/hooks/useTelemetryStream';
import { usEquitySession } from '@/lib/intelligence/market-hours';
import { STATUS_LABELS } from '@/lib/intelligence/labels';
import type { MarketPulse, SignalDetailView, SignalView } from '@/lib/intelligence/queries';
import { isCryptoSymbol } from '@/lib/market/symbols';
import { cn, formatPrice } from '@/lib/utils';
import { age, clock, formatEvidence, tone, toneText } from './format';
import { FreshnessBadge } from './FreshnessBadge';
import { SignalDetail } from './SignalDetail';
import { useNow } from './useNow';

type Scope = 'all' | 'stocks' | 'crypto' | 'watchlist';
type Tone = 'any' | 'bullish' | 'bearish';

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'stocks', label: 'Stocks' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'watchlist', label: 'Watchlist' },
];
const TONES: { value: Tone; label: string }[] = [
  { value: 'any', label: 'Any direction' },
  { value: 'bullish', label: 'Bullish' },
  { value: 'bearish', label: 'Bearish' },
];
const HIGH_CONFIDENCE = 70;
const REFRESH_MS = 60_000;
const ENDED = new Set(['INVALIDATED', 'RESOLVED']);

const STREAM_LABELS: Record<StreamStatus, string> = {
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
  polling: 'Updating every 30 seconds',
};

type Props = {
  symbols: string[];
  initialSignals: SignalView[];
  initialDetail: SignalDetailView | null;
  pulse: Record<string, MarketPulse>;
  initialEvents: TelemetryEvent[];
  lastAnalysis: string | null;
};

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'press h-9 rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors duration-150',
        pressed ? 'border-ink bg-ink text-canvas' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink'
      )}
    >
      {children}
    </button>
  );
}

function LiveMarket({ symbols, pulse, ticks, openBySymbol, now }: {
  symbols: string[];
  pulse: Record<string, MarketPulse>;
  ticks: Map<string, { price: number; changePercent?: number; at: string }>;
  openBySymbol: Map<string, SignalView>;
  now: number | null;
}) {
  const stocksClosed = now !== null && usEquitySession(new Date(now)) !== 'regular';
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
      {symbols.slice(0, 12).map((symbol) => {
        const tick = ticks.get(symbol);
        const base = pulse[symbol];
        const price = tick?.price ?? base?.price;
        const change = tick?.changePercent ?? base?.changePct ?? undefined;
        const at = [tick?.at, base?.at].filter(Boolean).sort().at(-1) ?? null;
        const signal = openBySymbol.get(symbol);
        return (
          <li key={symbol}>
            <Link
              href={`/stocks/${symbol}`}
              className="block rounded-lg border border-line bg-surface p-3 transition-colors duration-150 hover:border-line-strong hover:bg-surface-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-ink">{symbol}</span>
                {signal && <span className={cn('size-1.5 flex-none rounded-full', tone(signal.direction) === 'down' ? 'bg-down' : 'bg-up')} title={signal.title} />}
              </div>
              <div className="num mt-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-[15px] text-ink">{price != null ? formatPrice(price) : '—'}</span>
                {change != null && (
                  <span className={cn('text-xs', change > 0 ? 'text-up' : change < 0 ? 'text-down' : 'text-ink-2')}>
                    {change > 0 ? '+' : ''}
                    {change.toFixed(2)}%
                  </span>
                )}
              </div>
              <FreshnessBadge updatedAt={at} now={now} closed={!isCryptoSymbol(symbol) && stocksClosed} className="mt-1 text-xs" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function FeedRow({ signal, selected, now, onSelect }: { signal: SignalView; selected: boolean; now: number | null; onSelect: () => void }) {
  const ended = ENDED.has(signal.status);
  const lead = signal.evidence.find((e) => e.key === 'price') ?? signal.evidence[0];
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'flex w-full gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2',
          selected && 'bg-surface-2',
          ended && 'opacity-70'
        )}
      >
        <time dateTime={signal.updatedAt} className="num w-14 flex-none pt-0.5 text-[13px] text-ink-3">
          {now === null ? '' : clock(signal.updatedAt)}
        </time>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-ink">{signal.symbol}</span>
            <span className={cn('truncate text-sm', ended ? 'text-ink-2' : toneText(signal.direction))}>{signal.title}</span>
          </p>
          <p className="num mt-0.5 text-[13px] text-ink-2">
            {lead ? `${lead.label} ${formatEvidence(lead)} · ` : ''}
            Strength {signal.strength} · Confidence {signal.confidence}%
          </p>
        </div>
        <span className="meta flex-none pt-0.5">{STATUS_LABELS[signal.status]}</span>
      </button>
    </li>
  );
}

export default function SignalsClient({ symbols, initialSignals, initialDetail, pulse, initialEvents, lastAnalysis }: Props) {
  const router = useRouter();
  const now = useNow();
  const { events, status, online } = useTelemetryStream(initialEvents);
  const [signals, setSignals] = useState(initialSignals);
  const [selectedId, setSelectedId] = useState<string | null>(initialDetail?.signalId ?? initialSignals[0]?.signalId ?? null);
  const [detail, setDetail] = useState<SignalDetailView | null>(initialDetail);
  const [scope, setScope] = useState<Scope>('all');
  const [direction, setDirection] = useState<Tone>('any');
  const [highOnly, setHighOnly] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch('/api/signals', { cache: 'no-store' });
      if (!res.ok) return;
      const body = (await res.json()) as { signals: SignalView[]; fetchedAt: string };
      setSignals(body.signals);
      setFetchedAt(body.fetchedAt);
    } catch {
      /* keep the last list; the next refresh tries again */
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/signals/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (res.ok) setDetail(((await res.json()) as { signal: SignalDetailView }).signal);
    } catch {
      /* the panel keeps the last version */
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(refreshList, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refreshList]);

  useEffect(() => {
    if (selectedId && detail?.signalId !== selectedId) void loadDetail(selectedId);
  }, [selectedId, detail?.signalId, loadDetail]);

  // New stream events: signal changes refresh the list and the open panel; alerts become toasts
  const seen = useRef(new Set(initialEvents.map((e) => e.id)));
  useEffect(() => {
    const fresh = events.filter((e) => !seen.current.has(e.id));
    if (!fresh.length) return;
    fresh.forEach((e) => seen.current.add(e.id));
    const signalChanges = fresh.filter((e) => e.type === EVENT_TYPES.SIGNAL_UPDATED);
    if (signalChanges.length) {
      void refreshList();
      if (selectedId && signalChanges.some((e) => e.payload.signalId === selectedId)) void loadDetail(selectedId);
    }
    for (const alert of fresh.filter((e) => e.type === EVENT_TYPES.ALERT_TRIGGERED)) {
      toast(String(alert.payload.message ?? 'Alert triggered'), { icon: <Bell className="size-4" />, description: alert.symbol });
    }
  }, [events, refreshList, loadDetail, selectedId]);

  const ticks = useMemo(() => {
    const out = new Map<string, { price: number; changePercent?: number; at: string }>();
    const latest = latestTicks(events);
    for (const event of events) {
      if (event.type !== EVENT_TYPES.PRICE_CHANGED || !event.symbol || out.has(event.symbol)) continue;
      const tick = latest.get(event.symbol);
      if (tick) out.set(event.symbol, { ...tick, at: event.createdAt });
    }
    return out;
  }, [events]);

  const tracked = useMemo(() => new Set(symbols), [symbols]);
  const openBySymbol = useMemo(() => {
    const map = new Map<string, SignalView>();
    for (const s of signals) if (!ENDED.has(s.status) && !map.has(s.symbol)) map.set(s.symbol, s);
    return map;
  }, [signals]);

  const visible = useMemo(
    () =>
      signals.filter((s) => {
        if (scope === 'stocks' && s.assetType === 'crypto') return false;
        if (scope === 'crypto' && s.assetType !== 'crypto') return false;
        if (scope === 'watchlist' && !tracked.has(s.symbol)) return false;
        if (direction !== 'any' && tone(s.direction) !== (direction === 'bullish' ? 'up' : 'down')) return false;
        if (highOnly && s.confidence < HIGH_CONFIDENCE) return false;
        return true;
      }),
    [signals, scope, direction, highOnly, tracked]
  );

  const select = (id: string) => {
    // Wide screens show the detail beside the feed; phones open it as a page
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setSelectedId(id);
      window.history.replaceState(null, '', `/signals?signal=${encodeURIComponent(id)}`);
    } else {
      router.push(`/signals/${encodeURIComponent(id)}`);
    }
  };

  const live = online && status === 'live';
  const analyzedAt = lastAnalysis;

  return (
    <PageEnter className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Signals</h1>
          <p className="page-lede">What is moving across the assets you follow, what agrees, and how sure Signalist is.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span role="status" className="inline-flex items-center gap-2 text-[13px] text-ink-2">
            <span className={cn('size-1.5 rounded-full', live ? 'animate-pulse-soft bg-up' : 'bg-ink-3')} aria-hidden />
            {online ? STREAM_LABELS[status] : 'Offline'}
          </span>
          <span className="meta">
            {analyzedAt && now !== null ? `Markets last analyzed ${age(analyzedAt, now)}` : ' '}
            {fetchedAt && now !== null ? ` · list refreshed ${age(fetchedAt, now)}` : ''}
          </span>
        </div>
      </header>

      {symbols.length > 0 && (
        <section aria-labelledby="live-market" className="space-y-3">
          <h2 id="live-market" className="section-title">
            Live market
          </h2>
          <LiveMarket symbols={symbols} pulse={pulse} ticks={ticks} openBySymbol={openBySymbol} now={now} />
        </section>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-labelledby="signal-feed" className="min-w-0 space-y-3">
          <h2 id="signal-feed" className="section-title">
            Signal feed
          </h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter signals">
            {SCOPES.map((s) => (
              <Chip key={s.value} pressed={scope === s.value} onClick={() => setScope(s.value)}>
                {s.label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by direction and confidence">
            {TONES.map((t) => (
              <Chip key={t.value} pressed={direction === t.value} onClick={() => setDirection(t.value)}>
                {t.label}
              </Chip>
            ))}
            <Chip pressed={highOnly} onClick={() => setHighOnly((v) => !v)}>
              High confidence
            </Chip>
          </div>

          {visible.length ? (
            <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {visible.map((signal) => (
                <FeedRow key={signal.signalId} signal={signal} selected={signal.signalId === selectedId} now={now} onSelect={() => select(signal.signalId)} />
              ))}
            </ol>
          ) : (
            <EmptyState
              icon={Activity}
              title={signals.length ? 'No signals match these filters' : 'No significant signals right now'}
              description={
                signals.length
                  ? 'Try a wider filter. Signals from the last 48 hours are listed.'
                  : 'Signalist checks every asset on a watchlist every two minutes. A quiet market looks quiet: a signal appears only when several independent pieces of evidence agree.'
              }
              actionLabel={symbols.length ? undefined : 'Add to your watchlist'}
              actionHref={symbols.length ? undefined : '/watchlist'}
            />
          )}
        </section>

        <section aria-label="Signal detail" className="hidden min-w-0 lg:sticky lg:top-24 lg:block">
          {detail && detail.signalId === selectedId ? (
            <div className="surface-card p-6">
              <SignalDetail signal={detail} now={now} />
            </div>
          ) : selectedId ? (
            <div className="surface-card h-96 p-6" aria-busy="true">
              <div className="skeleton-shimmer h-6 w-40 rounded-md" />
              <div className="skeleton-shimmer mt-4 h-10 w-72 rounded-md" />
              <div className="skeleton-shimmer mt-6 h-40 w-full rounded-md" />
            </div>
          ) : (
            <p className="meta">Select a signal to see its evidence.</p>
          )}
        </section>
      </div>
    </PageEnter>
  );
}
