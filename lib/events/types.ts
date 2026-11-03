export type PriceChangedEvent = {
  symbol: string;
  price: number;
  changePercent?: number;
  timestamp: string;
};

export type AlertTriggeredEvent = {
  alertId: string;
  symbol: string;
  company: string;
  message: string;
  price?: number;
  changePercent?: number;
  timestamp: string;
};

export type SignalKind = 'unusual_move' | 'rsi_cross' | 'macd_cross' | 'bollinger_break' | 'volume_spike';
export type SignalDirection = 'up' | 'down';

export type SignalDetectedEvent = {
  symbol: string;
  kind: SignalKind;
  direction: SignalDirection;
  label: string;
  detail: string;
  price: number;
  timestamp: string;
};

export type AiReportCreatedEvent = {
  reportId: string;
  symbol: string;
  summary: string;
  timestamp: string;
};

/** A signal was created or changed status. Strength ticks alone don't publish. */
export type SignalUpdatedEvent = {
  signalId: string;
  symbol: string;
  title: string;
  type: string;
  direction: string;
  status: string;
  strength: number;
  confidence: number;
  /** The latest lifecycle note, e.g. "Price moved back through 214.20". */
  note: string;
  timestamp: string;
};

export const EVENT_TYPES = {
  PRICE_CHANGED: 'market.price_changed',
  SIGNAL_DETECTED: 'market.signal_detected',
  SIGNAL_UPDATED: 'market.signal_updated',
  ALERT_TRIGGERED: 'alert.triggered',
  AI_REPORT_CREATED: 'ai.report_created',
} as const;

export type TelemetryEventInput =
  | { type: typeof EVENT_TYPES.PRICE_CHANGED; payload: PriceChangedEvent; userId?: undefined }
  | { type: typeof EVENT_TYPES.SIGNAL_DETECTED; payload: SignalDetectedEvent; userId?: undefined }
  | { type: typeof EVENT_TYPES.SIGNAL_UPDATED; payload: SignalUpdatedEvent; userId?: undefined }
  | { type: typeof EVENT_TYPES.ALERT_TRIGGERED; payload: AlertTriggeredEvent; userId: string }
  | { type: typeof EVENT_TYPES.AI_REPORT_CREATED; payload: AiReportCreatedEvent; userId?: string };

/** What the feed sends to the browser. `userId` is never included. */
export type TelemetryEvent = {
  id: string;
  type: TelemetryEventInput['type'];
  symbol?: string;
  payload: Record<string, unknown>;
  createdAt: string;
};
