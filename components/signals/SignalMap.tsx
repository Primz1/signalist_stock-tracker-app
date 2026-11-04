'use client';

import type { SignalDetailView, SignalEventView } from '@/lib/intelligence/queries';
import { cn } from '@/lib/utils';
import { tone } from './format';

type Node = { type: string; label: string; facts: string; minutes: number; stance: 'supports' | 'contradicts' | 'context' };

/** One node per event type, at its first occurrence, in time order. */
function nodesFor(signal: SignalDetailView): Node[] {
  const side = tone(signal.direction);
  const start = new Date(signal.startedAt).getTime();
  const first = new Map<string, SignalEventView>();
  for (const event of signal.events) if (!first.has(event.type)) first.set(event.type, event);
  return [...first.values()].map((e) => ({
    type: e.type,
    label: e.label,
    facts: e.facts,
    minutes: Math.round((new Date(e.time).getTime() - start) / 60_000),
    stance: e.direction === 'neutral' ? 'context' : (e.direction === 'up') === (side === 'up') ? 'supports' : 'contradicts',
  }));
}

const NODE_H = 52;
const GAP = 12;
const WIDTH = 640;
const LEFT_W = 330;
const SIGNAL_W = 200;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const offset = (m: number) => (m <= 0 ? 'at start' : `+${m} min`);

/**
 * How the evidence feeds the conclusion: each kind of event on the left, the signal on the
 * right. Small screens get the same information as a list.
 */
export function SignalMap({ signal }: { signal: SignalDetailView }) {
  const nodes = nodesFor(signal);
  if (!nodes.length) return <p className="meta">The events behind this signal have expired from storage.</p>;

  const height = Math.max(nodes.length * (NODE_H + GAP) - GAP, NODE_H) + 8;
  const targetY = height / 2;
  const targetX = WIDTH - SIGNAL_W;
  const side = tone(signal.direction);
  const stroke = (stance: Node['stance']) =>
    stance === 'contradicts' ? 'var(--sg-ink-3)' : stance === 'context' ? 'var(--sg-line-strong)' : side === 'down' ? 'var(--sg-down)' : side === 'up' ? 'var(--sg-up)' : 'var(--sg-ink-2)';

  return (
    <>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="hidden w-full sm:block"
        role="img"
        aria-label={`${nodes.length} kinds of event led to ${signal.title}: ${nodes.map((n) => n.label).join(', ')}`}
      >
        {nodes.map((node, i) => {
          const y = 4 + i * (NODE_H + GAP);
          const midY = y + NODE_H / 2;
          const startX = LEFT_W;
          const path = `M ${startX} ${midY} C ${startX + 80} ${midY}, ${targetX - 80} ${targetY}, ${targetX} ${targetY}`;
          return (
            <g key={node.type}>
              <path d={path} fill="none" stroke={stroke(node.stance)} strokeWidth={1.5} strokeDasharray={node.stance === 'contradicts' ? '4 4' : undefined} />
              <rect x={0} y={y} width={LEFT_W} height={NODE_H} rx={10} fill="var(--sg-surface-2)" stroke="var(--sg-line)" />
              <text x={14} y={y + 21} fontSize={13} fontWeight={600} fill="var(--sg-ink)">
                {clip(node.label, 26)}
                <tspan fill="var(--sg-ink-3)" fontWeight={400}>{`  ${offset(node.minutes)}`}</tspan>
              </text>
              <text x={14} y={y + 39} fontSize={12} fill="var(--sg-ink-2)">
                {clip(node.facts, 46)}
              </text>
            </g>
          );
        })}
        <rect x={targetX} y={targetY - 34} width={SIGNAL_W} height={68} rx={12} fill="var(--sg-surface)" stroke={stroke('supports')} strokeWidth={1.5} />
        <text x={targetX + 14} y={targetY - 9} fontSize={13} fontWeight={600} fill="var(--sg-ink)">
          {clip(signal.title, 24)}
        </text>
        <text x={targetX + 14} y={targetY + 14} fontSize={12} fill="var(--sg-ink-2)" className="num">
          {`Strength ${signal.strength} · Confidence ${signal.confidence}`}
        </text>
      </svg>

      <ol className="space-y-2 sm:hidden">
        {nodes.map((node) => (
          <li key={node.type} className="flex items-start gap-3 rounded-lg border border-line bg-surface-2 p-3">
            <span
              className={cn('mt-1.5 size-2 flex-none rounded-full', node.stance === 'contradicts' ? 'bg-ink-3' : node.stance === 'context' ? 'bg-line-strong' : side === 'down' ? 'bg-down' : 'bg-up')}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {node.label} <span className="font-normal text-ink-3">{offset(node.minutes)}</span>
              </p>
              <p className="text-sm text-ink-2 [overflow-wrap:anywhere]">{node.facts}</p>
            </div>
          </li>
        ))}
        <li className="rounded-lg border border-line-strong p-3 text-sm font-semibold text-ink">→ {signal.title}</li>
      </ol>
    </>
  );
}
