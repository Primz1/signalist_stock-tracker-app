'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, Minus, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { refreshSignalExplanation } from '@/lib/actions/telemetry.actions';
import { COMPONENT_LABELS, CONTEXT_LABELS, STATUS_LABELS } from '@/lib/intelligence/labels';
import type { SignalDetailView } from '@/lib/intelligence/queries';
import { cn, formatPrice } from '@/lib/utils';
import { clock, formatEvidence, toneText } from './format';
import { FreshnessBadge } from './FreshnessBadge';
import { SignalMap } from './SignalMap';

const ENDED = new Set(['INVALIDATED', 'RESOLVED']);

function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="label-sm">{label}</dt>
      <dd className="num mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</dd>
      {hint && <dd className="meta mt-0.5">{hint}</dd>}
    </div>
  );
}

function StatusPill({ status }: { status: SignalDetailView['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-semibold',
        ENDED.has(status) ? 'border-line text-ink-3' : status === 'WEAKENING' ? 'border-line-strong text-ink-2' : 'border-ink text-ink'
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

const STANCE_ICON = { supports: Check, contradicts: X, context: Minus } as const;

function WhySection({ signal }: { signal: SignalDetailView }) {
  return (
    <section aria-labelledby="why-signal">
      <h3 id="why-signal" className="text-base font-semibold text-ink">
        Why Signalist says this
      </h3>
      <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
        {signal.evidence.map((item) => {
          const Icon = STANCE_ICON[item.stance];
          return (
            <li key={item.key} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <Icon
                className={cn('size-4 flex-none', item.stance === 'supports' ? 'text-up' : item.stance === 'contradicts' ? 'text-down' : 'text-ink-3')}
                strokeWidth={2}
                aria-label={item.stance}
              />
              <span className="min-w-0 flex-1 text-ink-2">{item.label}</span>
              <span className="num font-semibold text-ink">{formatEvidence(item)}</span>
            </li>
          );
        })}
      </ul>
      <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {Object.entries(signal.components).map(([key, value]) => (
          <div key={key} className="flex items-center gap-3">
            <dt className="w-32 flex-none text-[13px] text-ink-2">{COMPONENT_LABELS[key as keyof typeof COMPONENT_LABELS] ?? key}</dt>
            <dd className="flex min-w-0 flex-1 items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                <span className="block h-full rounded-full bg-ink" style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
              </span>
              <span className="num w-8 text-right text-[13px] text-ink">{Math.round((value ?? 0) * 100)}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="meta mt-3">
        Strength measures how forceful the move is. Confidence measures how much independent evidence agrees. They are scored separately.{' '}
        <Link href="/signals/how-it-works" className="underline underline-offset-2 hover:text-ink">
          How scoring works
        </Link>
      </p>
    </section>
  );
}

function AiSection({ signal }: { signal: SignalDetailView }) {
  const [explanation, setExplanation] = useState(signal.explanation);
  const [pending, startTransition] = useTransition();

  const refresh = () =>
    startTransition(async () => {
      const res = await refreshSignalExplanation(signal.signalId);
      if (res.success) setExplanation(res.explanation);
      else toast.error(res.message);
    });

  return (
    <section aria-labelledby="what-changed">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="what-changed" className="text-base font-semibold text-ink">
          What changed
        </h3>
        <button type="button" onClick={refresh} disabled={pending} className="text-btn h-11 gap-1.5 text-[13px]">
          <RefreshCw className={cn('size-3.5', pending && 'animate-spin')} aria-hidden />
          {pending ? 'Explaining…' : explanation ? 'Refresh' : 'Explain'}
        </button>
      </div>
      {explanation ? (
        <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-ink-2">
          <p>{explanation.whatChanged}</p>
          {explanation.context && (
            <p>
              <span className="font-semibold text-ink">Context. </span>
              {explanation.context}
            </p>
          )}
          {explanation.watchNext && (
            <p>
              <span className="font-semibold text-ink">Watch next. </span>
              {explanation.watchNext}
            </p>
          )}
          <p className="meta">
            {explanation.source === 'ai'
              ? 'Written by AI from the evidence above. Every number was checked against it.'
              : 'Written from Signalist data alone; the AI explanation was unavailable or failed a check.'}{' '}
            Not investment advice.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-ink-3">An explanation is written when the signal is confirmed. You can ask for one now.</p>
      )}
    </section>
  );
}

function Timeline({ signal, now }: { signal: SignalDetailView; now: number | null }) {
  const rows = [
    ...signal.events.map((e) => ({ at: e.time, title: e.label, detail: e.facts, kind: 'event' as const })),
    ...signal.history.map((h) => ({ at: h.at, title: STATUS_LABELS[h.status], detail: h.note, kind: 'status' as const })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <section aria-labelledby="signal-timeline">
      <h3 id="signal-timeline" className="text-base font-semibold text-ink">
        Timeline
      </h3>
      <ol className="mt-3 space-y-0">
        {rows.map((row, i) => (
          <li key={`${row.at}-${i}`} className="relative flex gap-3 pb-4 pl-5 last:pb-0">
            <span
              className={cn('absolute top-1.5 left-0 size-2 rounded-full', row.kind === 'status' ? 'bg-ink' : 'border border-ink-3 bg-canvas')}
              aria-hidden
            />
            {i < rows.length - 1 && <span className="absolute top-4 bottom-0 left-[3.5px] w-px bg-line" aria-hidden />}
            {/* Local time only after mount, so server and browser render the same markup */}
            <time dateTime={row.at} className="num w-16 flex-none text-[13px] text-ink-3">
              {now === null ? '' : clock(row.at)}
            </time>
            <div className="min-w-0">
              <p className={cn('text-sm', row.kind === 'status' ? 'font-semibold text-ink' : 'text-ink')}>{row.title}</p>
              <p className="text-sm text-ink-2 [overflow-wrap:anywhere]">{row.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SignalDetail({ signal, now }: { signal: SignalDetailView; now: number | null }) {
  const ended = ENDED.has(signal.status);
  const provenance = signal.provenance;

  return (
    <article className="space-y-8" aria-labelledby="signal-title">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/stocks/${signal.symbol}`} className="text-sm font-semibold text-ink hover:underline">
            {signal.symbol}
          </Link>
          <StatusPill status={signal.status} />
          <span className="meta">{CONTEXT_LABELS[signal.context]}</span>
        </div>
        <h2 id="signal-title" className={cn('text-[28px] font-semibold leading-tight tracking-[-0.02em]', ended ? 'text-ink-2' : toneText(signal.direction))}>
          {signal.title}
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Strength" value={signal.strength} hint="of 100" />
          <Metric label="Confidence" value={`${signal.confidence}%`} />
          <Metric label="Started" value={<time dateTime={signal.startedAt}>{now === null ? '' : clock(signal.startedAt)}</time>} />
          <Metric
            label={signal.keyLevel != null ? 'Key level' : 'Last price'}
            value={signal.keyLevel != null ? formatPrice(signal.keyLevel) : signal.latest ? formatPrice(signal.latest.price) : '—'}
          />
        </dl>
        {signal.latest && (
          <p className="text-sm text-ink-2">
            <span className="num font-semibold text-ink">{formatPrice(signal.latest.price)}</span>
            {signal.latest.changePct != null && (
              <span className={cn('num ml-2', signal.latest.changePct >= 0 ? 'text-up' : 'text-down')}>
                {signal.latest.changePct > 0 ? '+' : ''}
                {signal.latest.changePct.toFixed(2)}% today
              </span>
            )}
            <FreshnessBadge updatedAt={signal.latest.at} now={now} className="ml-3" />
          </p>
        )}
      </header>

      <section aria-labelledby="signal-map">
        <h3 id="signal-map" className="mb-3 text-base font-semibold text-ink">
          Signal map
        </h3>
        <SignalMap signal={signal} />
      </section>

      <WhySection signal={signal} />
      <AiSection key={signal.signalId} signal={signal} />
      <Timeline signal={signal} now={now} />

      <footer className="meta border-t border-line pt-4">
        {provenance ? (
          <>
            Prices from {provenance.priceSource ?? 'unknown source'}
            {provenance.fallback ? ' (fallback provider)' : ''}. Data as of{' '}
            {provenance.sourceTimestamp && now !== null ? clock(provenance.sourceTimestamp) : '—'}, calculated{' '}
            {now !== null ? clock(provenance.calculatedAt) : ''}.{' '}
          </>
        ) : null}
        Signalist describes market activity. It does not give investment advice.
      </footer>
    </article>
  );
}
