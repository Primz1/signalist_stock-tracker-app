import type { MarketSession } from './types';

/**
 * US equity sessions in New York time. Crypto never closes. Holidays come from the NYSE
 * calendar. Production also asks Finnhub's market-status endpoint, which wins when it answers.
 */

const NYSE_HOLIDAYS = new Set([
  // 2026
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03',
  '2026-09-07', '2026-11-26', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05',
  '2027-09-06', '2027-11-25', '2027-12-24',
]);

/** Regular session ends at 13:00 on these days. */
const NYSE_EARLY_CLOSES = new Set(['2026-11-27', '2026-12-24', '2027-11-26']);

const PRE_OPEN = 4 * 60;
const REGULAR_OPEN = 9 * 60 + 30;
const REGULAR_CLOSE = 16 * 60;
const EARLY_CLOSE = 13 * 60;
const POST_CLOSE = 20 * 60;

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});

export function newYorkParts(date: Date) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: parts.weekday as string,
  };
}

export function isTradingDay(isoDate: string, weekday: string) {
  return weekday !== 'Sat' && weekday !== 'Sun' && !NYSE_HOLIDAYS.has(isoDate);
}

export function usEquitySession(date: Date): MarketSession {
  const { isoDate, minuteOfDay, weekday } = newYorkParts(date);
  if (!isTradingDay(isoDate, weekday)) return 'closed';
  const close = NYSE_EARLY_CLOSES.has(isoDate) ? EARLY_CLOSE : REGULAR_CLOSE;
  if (minuteOfDay >= REGULAR_OPEN && minuteOfDay < close) return 'regular';
  if (minuteOfDay >= PRE_OPEN && minuteOfDay < REGULAR_OPEN) return 'pre';
  if (minuteOfDay >= close && minuteOfDay < POST_CLOSE) return 'post';
  return 'closed';
}

export function sessionFor(assetIsCrypto: boolean, date: Date): MarketSession {
  return assetIsCrypto ? 'continuous' : usEquitySession(date);
}

/** Groups bars into sessions: the New York trading date for stocks, the UTC date for crypto. */
export function sessionKey(assetIsCrypto: boolean, unixSeconds: number) {
  const date = new Date(unixSeconds * 1000);
  return assetIsCrypto ? date.toISOString().slice(0, 10) : newYorkParts(date).isoDate;
}

/** Minutes since the session started, used to compare volume at the same time of day. */
export function minuteOfSession(assetIsCrypto: boolean, unixSeconds: number) {
  const date = new Date(unixSeconds * 1000);
  if (assetIsCrypto) return date.getUTCHours() * 60 + date.getUTCMinutes();
  return newYorkParts(date).minuteOfDay - REGULAR_OPEN;
}
