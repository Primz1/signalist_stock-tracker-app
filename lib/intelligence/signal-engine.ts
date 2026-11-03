import type { DetectedEvent } from './detectors';
import type { BarSeries } from './series';
import { classifySignal, scoreSignal, type Score } from './scoring';
import type { ContextReading } from './context';
import type { AssetType, MarketEventType, SignalStatus, SignalType } from './types';

/**
 * Correlation and lifecycle. Events on one asset, in one direction, inside the
 * correlation window become one signal. That signal is updated as evidence arrives
 * and moves through DETECTED → ACTIVE → WEAKENING → INVALIDATED or RESOLVED,
 * instead of a new card appearing every minute.
 */

export const ENGINE_SETTINGS = {
  /** Events this close together on one asset are treated as one story. */
  correlationWindowMinutes: 30,
  /** A DETECTED signal that survives this long becomes ACTIVE. */
  confirmMinutes: 15,
  /** No new supporting event for this long and the signal is RESOLVED. */
  expireMinutes: 90,
  /** Strength below this share of its peak marks WEAKENING. */
  weakenRatio: 0.6,
  recoverRatio: 0.8,
  /** Closing back through the key level by this much invalidates the signal. */
  invalidationBufferPct: 0.15,
  /** Strength must change this much for the update to be recorded in history. */
  materialStrengthChange: 15,
  /** How far before the first event the anchor price is taken, for signals with no breakout level. */
  anchorBars: 15,
  /** Volatility-only signals need the ratio this high. */
  volatilitySignalRatio: 2.7,
  /** A directional signal only starts when the move itself has this much force. */
  minStartStrength: 45,
  /** ACTIVE and WEAKENING must hold this long before switching back, so status doesn't flap. */
  minStatusDwellMinutes: 10,
  /** Context is measured from this long before the first event. */
  contextLeadMinutes: 15,
  maxContextMinutes: 120,
} as const;

/** A DETECTED signal this strong is shown at once. Weaker ones wait until they survive to ACTIVE. */
export const IMMEDIATE_PUBLISH_STRENGTH = 55;

/**
 * Whether users, alerts and the AI hear about this signal. Every signal is stored, but
 * one that reverses within minutes never becomes a notification.
 */
export function isConfirmed(signal: Pick<EngineSignal, 'history' | 'peakStrength'>) {
  return signal.history.some((h) => h.status === 'ACTIVE' || h.status === 'WEAKENING') || signal.peakStrength >= IMMEDIATE_PUBLISH_STRENGTH;
}

/**
 * A signal needs a price, volume or level event at its core. RSI, MACD, moving-average
 * and VWAP crossings happen constantly on 1-minute bars, so they add confidence but
 * can't start a signal on their own.
 */
const ANCHOR_EVENTS: MarketEventType[] = ['PRICE_MOVE', 'VOLUME_SPIKE', 'BREAKOUT', 'BREAKDOWN'];

const E = ENGINE_SETTINGS;

export type EngineEvent = DetectedEvent & { eventId: string };

export type EngineSignal = {
  signalId: string;
  symbol: string;
  assetType: AssetType;
  type: SignalType;
  /** Raw direction used for correlation. The scored label lives in score.direction. */
  side: 'up' | 'down' | 'neutral';
  status: SignalStatus;
  score: Score;
  peakStrength: number;
  relatedEvents: string[];
  keyLevel?: number;
  /** Unix seconds. */
  startedAt: number;
  updatedAt: number;
  endedAt?: number;
  lastSupportAt: number;
  history: { status: SignalStatus; at: number; note: string }[];
};

export type EngineInput = {
  symbol: string;
  assetType: AssetType;
  series: BarSeries;
  i: number;
  /** Events detected on this bar. */
  newEvents: EngineEvent[];
  /** Every event on this asset from the last few hours, including newEvents. */
  recentEvents: EngineEvent[];
  /** Context over the given window ending now. */
  contextFor: (windowMinutes: number) => ContextReading;
  newsCount?: number;
};

export type EngineResult = {
  open: EngineSignal[];
  /** Signals created or materially changed on this bar, to persist and notify. */
  changed: EngineSignal[];
};

const isOpen = (s: EngineSignal) => s.status === 'DETECTED' || s.status === 'ACTIVE' || s.status === 'WEAKENING';
const ok = (n: number | undefined): n is number => n != null && Number.isFinite(n);

function inWindow(events: EngineEvent[], now: number, minutes: number) {
  return events.filter((e) => e.time <= now && now - e.time <= minutes * 60);
}

function qualifies(events: EngineEvent[], side: 'up' | 'down' | 'neutral', series: BarSeries, i: number) {
  if (side === 'neutral') {
    const ratio = series.volatilityRatio[i];
    return events.some((e) => e.eventType === 'VOLATILITY_EXPANSION') && ok(ratio) && ratio >= E.volatilitySignalRatio;
  }
  const directional = events.filter((e) => e.direction === side);
  const types = new Set(directional.map((e) => e.eventType));
  const anchors = directional.filter((e) => ANCHOR_EVENTS.includes(e.eventType));
  if (!anchors.length) return false;
  return anchors.some((e) => e.severity === 'high') || types.size >= 2;
}

function keyLevelFor(events: EngineEvent[], side: 'up' | 'down' | 'neutral', series: BarSeries, firstTime: number) {
  const breakEvent = events.find((e) => (side === 'up' ? e.eventType === 'BREAKOUT' : e.eventType === 'BREAKDOWN'));
  if (breakEvent && typeof breakEvent.data.level === 'number') return breakEvent.data.level;
  if (side === 'neutral') return undefined;
  // Otherwise the price just before the move began. Giving it all back invalidates the signal.
  const first = series.bars.findIndex((b) => b.time >= firstTime);
  const anchor = series.bars[Math.max(0, first - E.anchorBars)];
  return anchor?.close;
}

function crossedBack(signal: EngineSignal, close: number) {
  if (!ok(signal.keyLevel) || signal.side === 'neutral') return false;
  const buffer = E.invalidationBufferPct / 100;
  return signal.side === 'up' ? close < signal.keyLevel * (1 - buffer) : close > signal.keyLevel * (1 + buffer);
}

function transition(signal: EngineSignal, status: SignalStatus, at: number, note: string): EngineSignal {
  return {
    ...signal,
    status,
    updatedAt: at,
    endedAt: status === 'INVALIDATED' || status === 'RESOLVED' ? at : signal.endedAt,
    history: [...signal.history, { status, at, note }],
  };
}

export function stepSignals(open: EngineSignal[], input: EngineInput): EngineResult {
  const { series, i, newEvents, recentEvents } = input;
  const contextSince = (start: number) =>
    input.contextFor(Math.min(E.maxContextMinutes, Math.max(E.contextLeadMinutes, (series.bars[i].time - start) / 60 + E.contextLeadMinutes)));
  const now = series.bars[i].time;
  const close = series.close[i];
  const changed = new Map<string, EngineSignal>();
  const remember = (s: EngineSignal) => changed.set(s.signalId, s);
  let current = open.filter(isOpen);

  // 1. Update open signals with new evidence and check their lifecycle
  current = current.map((signal) => {
    let next = signal;
    const supporting = newEvents.filter((e) => e.direction === signal.side || (signal.side === 'neutral' && e.eventType === 'VOLATILITY_EXPANSION'));
    if (supporting.length) {
      next = {
        ...next,
        relatedEvents: Array.from(new Set([...next.relatedEvents, ...supporting.map((e) => e.eventId)])),
        lastSupportAt: now,
      };
    }

    const sinceStart = recentEvents.filter((e) => e.time >= signal.startedAt - E.correlationWindowMinutes * 60 && e.time <= now);
    const score = scoreSignal({ direction: signal.side, events: sinceStart, series, i, context: contextSince(signal.startedAt), newsCount: input.newsCount });
    const strengthJump = Math.abs(score.strength - signal.score.strength) >= E.materialStrengthChange;
    next = {
      ...next,
      score,
      peakStrength: Math.max(next.peakStrength, score.strength),
      type: signal.type === 'VOLATILITY_REGIME' ? signal.type : classifySignal(new Set(sinceStart.filter((e) => e.direction === signal.side).map((e) => e.eventType)), signal.side, sinceStart),
    };
    // A breakout confirmed after the signal began becomes the level the signal depends on
    const newBreak = supporting.find((e) => (e.eventType === 'BREAKOUT' || e.eventType === 'BREAKDOWN') && typeof e.data.level === 'number');
    if (newBreak) next = { ...next, keyLevel: newBreak.data.level as number };
    if (strengthJump || supporting.length) {
      next = { ...next, updatedAt: now };
      remember(next);
    }

    const end = (status: SignalStatus, note: string) => {
      const ended = transition(next, status, now, note);
      remember(ended);
      return ended;
    };
    // Stocks: a signal doesn't carry over the overnight close
    if (!series.crypto && i > 0 && series.session[i] !== series.session[i - 1]) return end('RESOLVED', 'Session ended');
    if (crossedBack(next, close)) return end('INVALIDATED', `Price moved back through ${next.keyLevel!.toFixed(2)}`);
    if (now - next.lastSupportAt >= E.expireMinutes * 60) {
      return end('RESOLVED', `No new confirmation for ${E.expireMinutes} minutes`);
    }
    if (next.status === 'DETECTED' && now - next.startedAt >= E.confirmMinutes * 60) {
      next = transition(next, 'ACTIVE', now, 'Signal remains active');
      remember(next);
    }
    const lastChange = next.history.at(-1)?.at ?? next.startedAt;
    const settled = now - lastChange >= E.minStatusDwellMinutes * 60;
    const weak = next.score.strength < next.peakStrength * E.weakenRatio;
    if (!settled || next.side === 'neutral') return next;
    if (next.status === 'ACTIVE' && weak) {
      next = transition(next, 'WEAKENING', now, 'Momentum weakening');
      remember(next);
    } else if (next.status === 'WEAKENING' && next.score.strength >= next.peakStrength * E.recoverRatio) {
      next = transition(next, 'ACTIVE', now, 'Momentum recovered');
      remember(next);
    }
    return next;
  });

  // 2. New events with no open signal on their side may start one
  if (newEvents.length) {
    const window = inWindow(recentEvents, now, E.correlationWindowMinutes);
    for (const side of ['up', 'down', 'neutral'] as const) {
      if (current.some((s) => isOpen(s) && s.side === side)) continue;
      if (!newEvents.some((e) => e.direction === side || (side === 'neutral' && e.eventType === 'VOLATILITY_EXPANSION'))) continue;
      if (!qualifies(window, side, series, i)) continue;

      const sideEvents = window.filter((e) => e.direction === side || (side === 'neutral' && e.eventType === 'VOLATILITY_EXPANSION'));
      const types = new Set<MarketEventType>(sideEvents.map((e) => e.eventType));
      const firstTime = Math.min(...sideEvents.map((e) => e.time));
      const score = scoreSignal({ direction: side, events: window, series, i, context: contextSince(firstTime), newsCount: input.newsCount });
      // Quiet markets should look quiet: events without a real move stay events
      if (side !== 'neutral' && score.strength < E.minStartStrength) continue;
      const type = classifySignal(types, side, sideEvents);
      const created: EngineSignal = {
        signalId: `${input.symbol}-${side}-${firstTime}`,
        symbol: input.symbol,
        assetType: input.assetType,
        type,
        side,
        status: 'DETECTED',
        score,
        peakStrength: score.strength,
        relatedEvents: sideEvents.map((e) => e.eventId),
        keyLevel: keyLevelFor(sideEvents, side, series, firstTime),
        startedAt: firstTime,
        updatedAt: now,
        lastSupportAt: now,
        history: [{ status: 'DETECTED', at: now, note: `Detected from ${types.size} event type${types.size === 1 ? '' : 's'}` }],
      };

      // A real move the other way ends the opposite signal
      if (side !== 'neutral') {
        current = current.map((s) => {
          if (!isOpen(s) || s.side === side || s.side === 'neutral') return s;
          const ended = transition(s, 'INVALIDATED', now, `Opposite ${side === 'up' ? 'bullish' : 'bearish'} signal detected`);
          remember(ended);
          return ended;
        });
      }
      current.push(created);
      remember(created);
    }
  }

  return { open: current.filter(isOpen), changed: [...changed.values()] };
}
