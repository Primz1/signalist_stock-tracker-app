import type { EvidenceItem, SignalDirection } from '@/lib/intelligence/types';

export const tone = (direction: SignalDirection | string) =>
  direction.includes('bullish') ? 'up' : direction.includes('bearish') ? 'down' : 'neutral';

export const toneText = (direction: SignalDirection | string) =>
  ({ up: 'text-up', down: 'text-down', neutral: 'text-ink-2' })[tone(direction)];

export function formatEvidence(item: EvidenceItem) {
  switch (item.unit) {
    case 'pct':
      return `${item.value > 0 ? '+' : ''}${item.value.toFixed(2)}%`;
    case 'x':
      return `${item.value.toFixed(1)}×`;
    case 'usd':
      return `$${item.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: item.value < 1 ? 6 : 2 })}`;
    case 'index':
      return item.value.toFixed(0);
    default:
      return String(item.value);
  }
}

/** Local clock time, e.g. "2:39 PM". Renders on the client to avoid hydration drift. */
export const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export function age(iso: string, now: number | null) {
  if (now === null) return '';
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}
