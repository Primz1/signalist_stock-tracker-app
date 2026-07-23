export type PriceChangedEvent = {
  symbol: string;
  price: number;
  changePercent?: number;
  timestamp: string;
};

export const EVENT_TYPES = {
  PRICE_CHANGED: 'market.price_changed',
  ALERT_TRIGGERED: 'alert.triggered',
  AI_REPORT_CREATED: 'ai.report_created',
} as const;
