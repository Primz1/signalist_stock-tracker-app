'use server';

import { fetchJSON } from '@/lib/actions/finnhub.actions';

export type EconomicEvent = {
  countryCode: string;
  time: string;
  eventName: string;
  actual: string | null;
  forecast: string | null;
  prior: string | null;
  impact: 'high' | 'medium' | 'low';
};

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const token = () => process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? '';

type FinnhubEcoEvent = {
  country?: string;
  event?: string;
  impact?: string;
  time?: string;
  actual?: number | string | null;
  estimate?: number | string | null;
  prev?: number | string | null;
};

const FALLBACK: EconomicEvent[] = [
  {
    countryCode: 'us',
    time: '08:30',
    eventName: 'CPI m/m',
    actual: null,
    forecast: '0.3%',
    prior: '0.2%',
    impact: 'high',
  },
  {
    countryCode: 'us',
    time: '10:00',
    eventName: 'Consumer Confidence',
    actual: null,
    forecast: '104.2',
    prior: '102.8',
    impact: 'medium',
  },
  {
    countryCode: 'eu',
    time: '07:00',
    eventName: 'ECB President Speech',
    actual: null,
    forecast: null,
    prior: null,
    impact: 'medium',
  },
  {
    countryCode: 'gb',
    time: '09:30',
    eventName: 'GDP q/q',
    actual: '0.1%',
    forecast: '0.1%',
    prior: '0.0%',
    impact: 'high',
  },
  {
    countryCode: 'jp',
    time: '23:50',
    eventName: 'BoJ Core CPI y/y',
    actual: '2.8%',
    forecast: '2.9%',
    prior: '3.1%',
    impact: 'high',
  },
  {
    countryCode: 'ca',
    time: '14:30',
    eventName: 'BoC Rate Decision',
    actual: null,
    forecast: '4.50%',
    prior: '4.50%',
    impact: 'high',
  },
];

function fmtVal(v: number | string | null | undefined): string | null {
  if (v == null || v === '') return null;
  return String(v);
}

function mapImpact(raw?: string): EconomicEvent['impact'] {
  const s = (raw || '').toLowerCase();
  if (s.includes('high') || s === '3') return 'high';
  if (s.includes('med') || s === '2') return 'medium';
  return 'low';
}

function countryToCode(country?: string): string {
  const c = (country || 'US').toUpperCase();
  const map: Record<string, string> = {
    US: 'us',
    USA: 'us',
    EU: 'eu',
    EA: 'eu',
    GB: 'gb',
    UK: 'gb',
    JP: 'jp',
    CA: 'ca',
    AU: 'au',
    CN: 'cn',
    DE: 'de',
    FR: 'fr',
  };
  if (map[c]) return map[c];
  return c.length === 2 ? c.toLowerCase() : 'us';
}

function formatEventTime(isoOrTime?: string): string {
  if (!isoOrTime) return '—';
  const d = new Date(isoOrTime);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/New_York',
    });
  }
  return isoOrTime.slice(0, 5);
}

export async function getEconomicCalendarEvents(): Promise<EconomicEvent[]> {
  const key = token();
  if (!key) return FALLBACK;

  try {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 3);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);
    const url = `${FINNHUB_BASE}/calendar/economic?from=${fromStr}&to=${toStr}&token=${key}`;
    const data = await fetchJSON<{ economicCalendar?: FinnhubEcoEvent[] }>(url, 600);
    const rows = data?.economicCalendar ?? [];
    if (!rows.length) return FALLBACK;

    const mapped = rows
      .slice(0, 12)
      .map((e) => ({
        countryCode: countryToCode(e.country),
        time: formatEventTime(e.time),
        eventName: e.event || 'Economic release',
        actual: fmtVal(e.actual),
        forecast: fmtVal(e.estimate),
        prior: fmtVal(e.prev),
        impact: mapImpact(e.impact),
      }))
      .filter((e) => e.eventName);

    return mapped.length ? mapped : FALLBACK;
  } catch {
    return FALLBACK;
  }
}
