import { fetchQuote } from '@/lib/market/ohlcv';

export type MarketingQuote = {
  symbol: string;
  name: string;
  price: string;
  priceNum: number;
  change: string;
  changePct: number;
  up: boolean;
  points: number[];
};

export type MarketingLiveData = {
  tape: MarketingQuote[];
  markets: MarketingQuote[];
  watchlist: MarketingQuote[];
  movers: MarketingQuote[];
  hero: {
    symbol: string;
    price: string;
    priceNum: number;
    change: string;
    changePct: number;
    up: boolean;
    aiScore: number | null;
  };
  research: {
    symbol: string;
    summary: string;
    confidence: number;
  } | null;
  stats: {
    watchlistCount: number;
    alertCount: number;
    researchLabel: string;
  };
};

const NAMES: Record<string, string> = {
  SPY: 'S&P 500 ETF',
  QQQ: 'Nasdaq 100',
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  AAPL: 'Apple',
  NVDA: 'NVIDIA',
  GLD: 'Gold ETF',
  TSLA: 'Tesla',
  MSFT: 'Microsoft',
  AMZN: 'Amazon',
  META: 'Meta',
  GOOGL: 'Alphabet',
  AMD: 'AMD',
};

const MARKET_APIS: { display: string; api: string }[] = [
  { display: 'SPY', api: 'SPY' },
  { display: 'QQQ', api: 'QQQ' },
  { display: 'BTC', api: 'BINANCE:BTCUSDT' },
  { display: 'ETH', api: 'BINANCE:ETHUSDT' },
  { display: 'AAPL', api: 'AAPL' },
  { display: 'NVDA', api: 'NVDA' },
  { display: 'GLD', api: 'GLD' },
];

const WATCH_APIS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMD'];
const TAPE_APIS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'META', 'GOOGL', 'AMD'];

function fmtPrice(n: number, crypto = false) {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (crypto || n >= 1000) {
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtChange(dp: number) {
  const sign = dp > 0 ? '+' : '';
  return `${sign}${dp.toFixed(2)}%`;
}

/** Deterministic sparkline from symbol + direction (no extra API). */
function sparkPoints(symbol: string, up: boolean): number[] {
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) seed += symbol.charCodeAt(i);
  const pts: number[] = [];
  let v = 8 + (seed % 5);
  for (let i = 0; i < 8; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const step = ((seed % 5) - 1) * (up ? 1 : -1);
    v = Math.max(2, Math.min(18, v + step));
    pts.push(v);
  }
  if (up) pts[pts.length - 1] = Math.max(...pts);
  else pts[pts.length - 1] = Math.min(...pts);
  return pts;
}

function enrich(
  display: string,
  price: number,
  changePct: number,
  crypto = false
): MarketingQuote {
  const up = changePct >= 0;
  return {
    symbol: display,
    name: NAMES[display] ?? display,
    price: fmtPrice(price, crypto),
    priceNum: price,
    change: fmtChange(changePct),
    changePct,
    up,
    points: sparkPoints(display, up),
  };
}

async function quoteOf(display: string, api: string): Promise<MarketingQuote | null> {
  const q = await fetchQuote(api);
  if (!q || !q.price) return null;
  const crypto = api.includes('BINANCE') || display === 'BTC' || display === 'ETH';
  return enrich(display, q.price, q.changePercent, crypto);
}

const FALLBACK: MarketingLiveData = {
  tape: [
    enrich('AAPL', 214.32, 1.24),
    enrich('NVDA', 131.88, 2.01),
    enrich('TSLA', 248.1, -0.84),
    enrich('MSFT', 428.55, 0.42),
  ],
  markets: [
    enrich('SPY', 548.12, 0.62),
    enrich('QQQ', 482.4, 0.91),
    enrich('BTC', 67420, -1.12, true),
    enrich('ETH', 3412, 0.44, true),
    enrich('AAPL', 214.32, 1.24),
    enrich('NVDA', 131.88, 2.01),
    enrich('GLD', 228.1, 0.18),
  ],
  watchlist: [
    enrich('AAPL', 214.32, 1.24),
    enrich('NVDA', 131.88, 2.01),
    enrich('TSLA', 248.1, -0.84),
    enrich('MSFT', 428.55, 0.42),
    enrich('AMD', 162.15, 1.88),
  ],
  movers: [],
  hero: {
    symbol: 'NVDA',
    price: '131.88',
    priceNum: 131.88,
    change: '+2.01%',
    changePct: 2.01,
    up: true,
    aiScore: 78,
  },
  research: {
    symbol: 'NVDA',
    summary: 'Trend above SMA50 with RSI cooling from overbought…',
    confidence: 72,
  },
  stats: { watchlistCount: 5, alertCount: 3, researchLabel: '72%' },
};

export async function getMarketingLiveData(): Promise<MarketingLiveData> {
  try {
    const [marketQuotes, watchQuotes, tapeQuotes, nvda] = await Promise.all([
      Promise.all(MARKET_APIS.map((m) => quoteOf(m.display, m.api))),
      Promise.all(WATCH_APIS.map((s) => quoteOf(s, s))),
      Promise.all(TAPE_APIS.map((s) => quoteOf(s, s))),
      quoteOf('NVDA', 'NVDA'),
    ]);

    const markets = marketQuotes.filter(Boolean) as MarketingQuote[];
    const watchlist = (watchQuotes.filter(Boolean) as MarketingQuote[]).slice(0, 5);
    const tape = (tapeQuotes.filter(Boolean) as MarketingQuote[]).slice(0, 8);
    const pool = [...markets, ...watchlist];
    const movers = [...pool]
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 4);

    let aiScore: number | null = null;
    let research: MarketingLiveData['research'] = FALLBACK.research;

    try {
      const { connectToDatabase } = await import('@/database/mongoose');
      await connectToDatabase();
      const { StockScoreModel } = await import('@/database/models/stockScore.model');
      const { AiReportModel } = await import('@/database/models/aiReport.model');
      const [scoreDoc, report] = await Promise.all([
        StockScoreModel.findOne({ symbol: 'NVDA' }).lean(),
        AiReportModel.findOne().sort({ createdAt: -1 }).lean(),
      ]);
      if (scoreDoc && typeof (scoreDoc as { score?: number }).score === 'number') {
        aiScore = Math.round((scoreDoc as { score: number }).score);
      }
      if (report) {
        const r = report as {
          symbol?: string;
          summary?: string;
          confidence?: number;
        };
        research = {
          symbol: String(r.symbol ?? 'NVDA'),
          summary: String(r.summary ?? FALLBACK.research!.summary).slice(0, 120),
          confidence: Math.round(
            (r.confidence ?? 0.72) * (r.confidence && r.confidence <= 1 ? 100 : 1)
          ),
        };
      }
    } catch {
      // DB optional on marketing
    }

    const heroBase = nvda ?? enrich('NVDA', 131.88, 2.01);
    const hero = {
      symbol: heroBase.symbol,
      price: heroBase.price,
      priceNum: heroBase.priceNum,
      change: heroBase.change,
      changePct: heroBase.changePct,
      up: heroBase.up,
      aiScore: aiScore ?? 78,
    };

    if (!markets.length && !watchlist.length) {
      return { ...FALLBACK, hero: { ...FALLBACK.hero, aiScore: aiScore ?? 78 }, research };
    }

    return {
      tape: tape.length ? tape : FALLBACK.tape,
      markets: markets.length ? markets : FALLBACK.markets,
      watchlist: watchlist.length ? watchlist : FALLBACK.watchlist,
      movers: movers.length ? movers : FALLBACK.watchlist.slice(0, 4),
      hero,
      research,
      stats: {
        watchlistCount: watchlist.length || FALLBACK.stats.watchlistCount,
        alertCount: movers.length || FALLBACK.stats.alertCount,
        researchLabel: research ? `${research.confidence}%` : 'Ready',
      },
    };
  } catch {
    return FALLBACK;
  }
}
