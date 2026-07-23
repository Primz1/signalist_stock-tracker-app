const FINNHUB_BASE = 'https://finnhub.io/api/v1';

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type FinnhubCandleResponse = {
  c?: number[];
  h?: number[];
  l?: number[];
  o?: number[];
  t?: number[];
  v?: number[];
  s?: string;
};

export async function fetchOhlcv(symbol: string, days = 90): Promise<Candle[]> {
  const token = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
  if (!token) return [];

  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 24 * 60 * 60;
  const url = `${FINNHUB_BASE}/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${token}`;

  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = (await res.json()) as FinnhubCandleResponse;
    if (data.s !== 'ok' || !data.t?.length) return [];

    return data.t.map((time, i) => ({
      time,
      open: data.o![i],
      high: data.h![i],
      low: data.l![i],
      close: data.c![i],
      volume: data.v?.[i],
    }));
  } catch {
    return [];
  }
}

export async function fetchQuote(symbol: string) {
  const token = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
  if (!token) return null;
  const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      price: typeof data.c === 'number' ? data.c : 0,
      changePercent: typeof data.dp === 'number' ? data.dp : 0,
      volume: typeof data.v === 'number' ? data.v : undefined,
    };
  } catch {
    return null;
  }
}
