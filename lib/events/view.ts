import { EVENT_TYPES, type SignalKind, type TelemetryEvent } from './types';

const MAX_EVENTS = 200;

export const SIGNAL_KIND_LABELS: Record<SignalKind, string> = {
  unusual_move: 'Move',
  rsi_cross: 'RSI',
  macd_cross: 'MACD',
  bollinger_break: 'Bands',
  volume_spike: 'Volume',
};

/** Adds new events, drops duplicates, and keeps the list newest first. */
export function mergeEvents(current: TelemetryEvent[], incoming: TelemetryEvent[]) {
  const byId = new Map([...incoming, ...current].map((event) => [event.id, event]));
  return Array.from(byId.values())
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, MAX_EVENTS);
}

/** Price ticks drive the live strip. Everything else belongs on the timeline. */
export const timelineEvents = (events: TelemetryEvent[]) =>
  events.filter((event) => event.type !== EVENT_TYPES.PRICE_CHANGED);

/** Newest tick per symbol. `events` must be newest first. */
export function latestTicks(events: TelemetryEvent[]) {
  const ticks = new Map<string, { price: number; changePercent?: number }>();
  for (const event of events) {
    if (event.type !== EVENT_TYPES.PRICE_CHANGED || !event.symbol || ticks.has(event.symbol)) continue;
    const { price, changePercent } = event.payload as { price: number; changePercent?: number };
    ticks.set(event.symbol, { price, changePercent });
  }
  return ticks;
}

/** Signal count per symbol and kind, for the heatmap. */
export function signalCounts(events: TelemetryEvent[]) {
  const counts = new Map<string, Partial<Record<SignalKind, number>>>();
  for (const event of events) {
    if (event.type !== EVENT_TYPES.SIGNAL_DETECTED || !event.symbol) continue;
    const kind = event.payload.kind as SignalKind;
    const row = counts.get(event.symbol) ?? {};
    row[kind] = (row[kind] ?? 0) + 1;
    counts.set(event.symbol, row);
  }
  return counts;
}
