'use server';

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { getCachedUser } from '@/lib/auth/session';
import { connectToDatabase } from '@/database/mongoose';
import {
  getOrCreatePortfolio,
  PortfolioModel,
  PortfolioTradeModel,
} from '@/database/models/portfolio.model';
import { fetchQuote } from '@/lib/market/ohlcv';
import { computeRealizedByTradeId } from '@/lib/portfolio/trade-realized';

const TRADE_HISTORY_TTL_SECONDS = 30;
const UNDO_WINDOW_MS = 5 * 60 * 1000;

const tradeHistoryTag = (userId: string) => `portfolio-trades:${userId}`;

const invalidateTradeHistory = (userId: string) => {
  revalidateTag(tradeHistoryTag(userId));
  revalidateTag(`tearsheet-${userId}`);
  revalidatePath('/portfolio');
  revalidatePath('/portfolio/history');
};

type ActionResult<T> = { success: true; data: T } | { success: false; message: string };

const serializePortfolio = (portfolio: Record<string, unknown>) => ({
  cash: Number(portfolio.cash ?? 0),
  initialCash: Number(portfolio.initialCash ?? 0),
  holdings: ((portfolio.holdings as Record<string, unknown>[]) || []).map((h) => ({
    symbol: String(h.symbol ?? ''),
    company: String(h.company ?? ''),
    quantity: Number(h.quantity ?? 0),
    avgCost: Number(h.avgCost ?? 0),
    price: h.price != null ? Number(h.price) : undefined,
    value: h.value != null ? Number(h.value) : undefined,
    pl: h.pl != null ? Number(h.pl) : undefined,
    changePercent: h.changePercent != null ? Number(h.changePercent) : undefined,
    dayPl: h.dayPl != null ? Number(h.dayPl) : undefined,
  })),
  totalValue: Number(portfolio.totalValue ?? 0),
  plTotal: Number(portfolio.plTotal ?? 0),
  plPercent: Number(portfolio.plPercent ?? 0),
  dayPl: Number(portfolio.dayPl ?? 0),
  dayPlPercent: Number(portfolio.dayPlPercent ?? 0),
});

const getUser = async () => getCachedUser();

export async function getPortfolio(): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const user = await getUser();
    if (!user?.id) return { success: false, message: 'Not authenticated' };

    await connectToDatabase();
    const portfolio = await getOrCreatePortfolio(user.id);

    let totalValue = portfolio.cash;
    let dayPl = 0;
    const holdingsWithPrice = await Promise.all(
      (portfolio.holdings || []).map(async (h) => {
        const quote = await fetchQuote(h.symbol);
        const price = quote?.price ?? h.avgCost;
        const value = price * h.quantity;
        totalValue += value;
        const pl = (price - h.avgCost) * h.quantity;
        const changePercent = quote?.changePercent ?? 0;
        const holdingDayPl = value * (changePercent / 100);
        dayPl += holdingDayPl;
        return { ...h, price, value, pl, changePercent, dayPl: holdingDayPl };
      })
    );

    const plTotal = totalValue - portfolio.initialCash;
    const plPercent = portfolio.initialCash ? (plTotal / portfolio.initialCash) * 100 : 0;
    const equity = totalValue - portfolio.cash;
    const dayPlPercent = totalValue > 0 ? (dayPl / totalValue) * 100 : 0;

    return {
      success: true,
      data: serializePortfolio({
        ...portfolio,
        holdings: holdingsWithPrice,
        totalValue,
        plTotal,
        plPercent,
        dayPl,
        dayPlPercent,
        equity,
      }),
    };
  } catch {
    return { success: false, message: 'Failed to load portfolio' };
  }
}

export async function executeTrade(params: {
  symbol: string;
  company: string;
  side: 'buy' | 'sell';
  quantity: number;
  note?: string;
}): Promise<ActionResult<Record<string, unknown>>> {
  const { symbol, company, side, quantity, note } = params;
  if (!symbol || quantity <= 0) return { success: false, message: 'Invalid trade' };

  try {
    const user = await getUser();
    if (!user?.id) return { success: false, message: 'Not authenticated' };

    await connectToDatabase();
    const portfolio = await getOrCreatePortfolio(user.id);
    const quote = await fetchQuote(symbol.toUpperCase());
    const price = quote?.price;
    if (!price) return { success: false, message: 'Price unavailable' };

    const total = price * quantity;
    const holdings = [...(portfolio.holdings || [])];
    const idx = holdings.findIndex((h) => h.symbol === symbol.toUpperCase());
    let avgCostAtSale: number | undefined;
    let realizedPl: number | undefined;

    if (side === 'buy') {
      if (portfolio.cash < total) return { success: false, message: 'Insufficient cash' };
      if (idx >= 0) {
        const h = holdings[idx];
        const newQty = h.quantity + quantity;
        holdings[idx] = {
          ...h,
          quantity: newQty,
          avgCost: (h.avgCost * h.quantity + total) / newQty,
        };
      } else {
        holdings.push({ symbol: symbol.toUpperCase(), company, quantity, avgCost: price });
      }
      await PortfolioModel.updateOne({ userId: user.id }, { $set: { holdings }, $inc: { cash: -total } });
    } else {
      if (idx < 0 || holdings[idx].quantity < quantity) {
        return { success: false, message: 'Insufficient shares' };
      }
      avgCostAtSale = holdings[idx].avgCost;
      realizedPl = (price - avgCostAtSale) * quantity;
      holdings[idx].quantity -= quantity;
      if (holdings[idx].quantity === 0) holdings.splice(idx, 1);
      await PortfolioModel.updateOne({ userId: user.id }, { $set: { holdings }, $inc: { cash: total } });
    }

    await PortfolioTradeModel.create({
      portfolioId: String(portfolio._id),
      userId: user.id,
      symbol: symbol.toUpperCase(),
      company,
      side,
      quantity,
      price,
      total,
      fees: 0,
      note: note?.trim() || undefined,
      avgCostAtSale,
      realizedPl,
    });

    invalidateTradeHistory(user.id);
    return getPortfolio();
  } catch {
    return { success: false, message: 'Trade failed' };
  }
}

export type TradeHistoryFilters = {
  symbols?: string[];
  side?: 'all' | 'buy' | 'sell';
  range?: '7d' | '30d' | '90d' | 'ytd' | 'all' | 'custom';
  from?: string;
  to?: string;
  noteQuery?: string;
  includeUndone?: boolean;
};

export type TradeRow = {
  id: string;
  symbol: string;
  company: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  fees: number;
  note?: string;
  avgCostAtSale?: number;
  realizedPl?: number;
  timestamp: string;
  undoneAt?: string;
  canUndo: boolean;
};

const rangeStart = (range: TradeHistoryFilters['range'], from?: string): Date | null => {
  if (range === 'custom' && from) return new Date(from);
  if (!range || range === 'all') return null;
  const now = new Date();
  if (range === 'ytd') return new Date(now.getFullYear(), 0, 1);
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
};

/** Cached enriched rows (canUndo is computed at read time — depends on wall clock). */
type CachedTradeRow = Omit<TradeRow, 'canUndo'>;

async function loadEnrichedTrades(userId: string): Promise<CachedTradeRow[]> {
  await connectToDatabase();
  // Load once; filters + realized backfill happen in memory (no N+1).
  const docs = await PortfolioTradeModel.find({ userId })
    .sort({ timestamp: 1 })
    .limit(2000)
    .lean();

  const enrichment = computeRealizedByTradeId(
    docs.map((t) => ({
      id: String(t._id),
      symbol: t.symbol,
      side: t.side,
      quantity: t.quantity,
      price: t.price,
      avgCostAtSale: t.avgCostAtSale,
      realizedPl: t.realizedPl,
      timestamp: t.timestamp,
      undoneAt: t.undoneAt,
    }))
  );

  return docs
    .map((t) => {
      const id = String(t._id);
      const filled = enrichment.get(id);
      const side = t.side as 'buy' | 'sell';
      return {
        id,
        symbol: t.symbol,
        company: t.company,
        side,
        quantity: Number(t.quantity),
        price: Number(t.price),
        total: Number(t.total),
        fees: Number(t.fees ?? 0),
        note: t.note,
        avgCostAtSale: side === 'sell' ? filled?.avgCostAtSale : undefined,
        realizedPl: side === 'sell' ? filled?.realizedPl : undefined,
        timestamp: new Date(t.timestamp).toISOString(),
        undoneAt: t.undoneAt ? new Date(t.undoneAt).toISOString() : undefined,
      } satisfies CachedTradeRow;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function getCachedEnrichedTrades(userId: string) {
  return unstable_cache(
    () => loadEnrichedTrades(userId),
    ['portfolio-trade-history', userId],
    {
      revalidate: TRADE_HISTORY_TTL_SECONDS,
      tags: [tradeHistoryTag(userId)],
    }
  )();
}

function applyTradeFilters(
  trades: CachedTradeRow[],
  filters: TradeHistoryFilters
): CachedTradeRow[] {
  const start = rangeStart(filters.range, filters.from);
  const end = filters.range === 'custom' && filters.to ? new Date(filters.to) : null;
  const symbols = filters.symbols?.map((s) => s.toUpperCase());
  const noteQ = filters.noteQuery?.trim().toLowerCase();

  return trades.filter((t) => {
    if (!filters.includeUndone && t.undoneAt) return false;
    if (filters.side && filters.side !== 'all' && t.side !== filters.side) return false;
    if (symbols?.length && !symbols.includes(t.symbol.toUpperCase())) return false;
    if (start && new Date(t.timestamp) < start) return false;
    if (end && new Date(t.timestamp) > end) return false;
    if (noteQ && !(t.note ?? '').toLowerCase().includes(noteQ)) return false;
    return true;
  });
}

export async function getTradeHistory(
  filters: TradeHistoryFilters = {}
): Promise<
  ActionResult<{
    trades: TradeRow[];
    summary: {
      tradeCount: number;
      buyCount: number;
      sellCount: number;
      realizedPl: number;
      winRate: number | null;
      mostTraded: string | null;
    };
  }>
> {
  try {
    const user = await getUser();
    if (!user?.id) return { success: false, message: 'Not authenticated' };

    const enriched = await getCachedEnrichedTrades(user.id);
    const filtered = applyTradeFilters(enriched, filters).slice(0, 500);
    const now = Date.now();

    const trades: TradeRow[] = filtered.map((t) => ({
      ...t,
      canUndo: !t.undoneAt && now - new Date(t.timestamp).getTime() <= UNDO_WINDOW_MS,
    }));

    const buys = trades.filter((t) => t.side === 'buy');
    const sells = trades.filter((t) => t.side === 'sell');
    const realizedPl = sells.reduce((s, t) => s + (t.realizedPl ?? 0), 0);
    const wins = sells.filter((t) => (t.realizedPl ?? 0) > 0).length;
    const winRate = sells.length ? wins / sells.length : null;
    const counts = new Map<string, number>();
    for (const t of trades) counts.set(t.symbol, (counts.get(t.symbol) || 0) + 1);
    let mostTraded: string | null = null;
    let mostCount = 0;
    for (const [sym, n] of counts) {
      if (n > mostCount) {
        mostTraded = sym;
        mostCount = n;
      }
    }

    return {
      success: true,
      data: {
        trades,
        summary: {
          tradeCount: trades.length,
          buyCount: buys.length,
          sellCount: sells.length,
          realizedPl,
          winRate,
          mostTraded,
        },
      },
    };
  } catch {
    return { success: false, message: 'Failed to load trade history' };
  }
}

export async function undoTrade(tradeId: string): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const user = await getUser();
    if (!user?.id) return { success: false, message: 'Not authenticated' };

    await connectToDatabase();
    const trade = await PortfolioTradeModel.findOne({ _id: tradeId, userId: user.id });
    if (!trade) return { success: false, message: 'Trade not found' };
    if (trade.undoneAt) return { success: false, message: 'Trade already undone' };

    const age = Date.now() - new Date(trade.timestamp).getTime();
    if (age > UNDO_WINDOW_MS) return { success: false, message: 'Undo window expired (5 min)' };

    const portfolio = await getOrCreatePortfolio(user.id);
    const holdings = [...(portfolio.holdings || [])];
    const idx = holdings.findIndex((h) => h.symbol === trade.symbol);
    const total = trade.total;

    if (trade.side === 'buy') {
      if (idx < 0 || holdings[idx].quantity < trade.quantity) {
        return { success: false, message: 'Cannot undo — shares already sold' };
      }
      holdings[idx].quantity -= trade.quantity;
      if (holdings[idx].quantity === 0) holdings.splice(idx, 1);
      await PortfolioModel.updateOne(
        { userId: user.id },
        { $set: { holdings }, $inc: { cash: total } }
      );
    } else {
      if (portfolio.cash < total) return { success: false, message: 'Cannot undo — insufficient cash' };
      const restoreCost = trade.avgCostAtSale ?? trade.price;
      if (idx >= 0) {
        const h = holdings[idx];
        const newQty = h.quantity + trade.quantity;
        holdings[idx] = {
          ...h,
          quantity: newQty,
          avgCost: (h.avgCost * h.quantity + restoreCost * trade.quantity) / newQty,
        };
      } else {
        holdings.push({
          symbol: trade.symbol,
          company: trade.company,
          quantity: trade.quantity,
          avgCost: restoreCost,
        });
      }
      await PortfolioModel.updateOne(
        { userId: user.id },
        { $set: { holdings }, $inc: { cash: -total } }
      );
    }

    trade.undoneAt = new Date();
    await trade.save();

    invalidateTradeHistory(user.id);
    return getPortfolio();
  } catch {
    return { success: false, message: 'Undo failed' };
  }
}

export async function getPortfolioAiReview(): Promise<
  ActionResult<{
    summary: string;
    confidence?: number;
    narrative?: Record<string, unknown>;
    snapshot?: Record<string, unknown>;
    rules_fired?: Record<string, unknown>[];
  }>
> {
  const portfolioRes = await getPortfolio();
  if (!portfolioRes.success) return portfolioRes;

  const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
  const secret = process.env.INTERNAL_API_SECRET || '';

  try {
    const res = await fetch(`${fastApiUrl}/agent/portfolio-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
      body: JSON.stringify({
        cash: portfolioRes.data.cash,
        holdings: portfolioRes.data.holdings,
      }),
    });
    if (!res.ok) return { success: false, message: 'AI review failed' };
    const data = await res.json();
    return {
      success: true,
      data: {
        summary: data.summary,
        confidence: data.confidence,
        narrative: data.narrative,
        snapshot: data.snapshot,
        rules_fired: data.rules_fired,
      },
    };
  } catch {
    return { success: false, message: 'AI service unavailable' };
  }
}

export type TearsheetMetrics = {
  cagr?: number | null;
  sharpe?: number | null;
  sortino?: number | null;
  max_drawdown?: number | null;
  volatility?: number | null;
  best_day?: number | null;
  worst_day?: number | null;
  skew?: number | null;
  win_rate?: number | null;
  alpha?: number | null;
  beta?: number | null;
};

export type TearsheetResult = {
  enough_history: boolean;
  message?: string;
  metrics: TearsheetMetrics;
  monthly_returns: Record<string, number>;
  drawdown_series: { t: string; v: number }[];
  equity_series: { t: string; v: number }[];
  day_count?: number;
};

/** Rebuild approximate daily NAV from initial cash + fills, then ask QuantStats. */
export async function getPortfolioTearsheet(): Promise<ActionResult<TearsheetResult>> {
  try {
    const user = await getUser();
    if (!user?.id) return { success: false, message: 'Not authenticated' };

    const cached = unstable_cache(
      () => computePortfolioTearsheet(user.id),
      [`tearsheet-${user.id}`],
      { revalidate: 300, tags: [`tearsheet-${user.id}`] }
    );
    return cached();
  } catch {
    return { success: false, message: 'Failed to build portfolio tear sheet' };
  }
}

async function computePortfolioTearsheet(userId: string): Promise<ActionResult<TearsheetResult>> {
  try {
    await connectToDatabase();
    const portfolio = await getOrCreatePortfolio(userId);
    const trades = (await getCachedEnrichedTrades(userId))
      .filter((t) => !t.undoneAt)
      .slice()
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const initialCash = Number(portfolio.initialCash ?? 0) || 10000;
    const symbols = new Set<string>();
    for (const t of trades) symbols.add(t.symbol.toUpperCase());
    for (const h of portfolio.holdings || []) symbols.add(String(h.symbol).toUpperCase());

    if (symbols.size === 0 && trades.length === 0) {
      return {
        success: true,
        data: {
          enough_history: false,
          message: 'No trades yet — tear sheet needs paper trade history.',
          metrics: {},
          monthly_returns: {},
          drawdown_series: [],
          equity_series: [],
        },
      };
    }

    const { fetchOhlcv } = await import('@/lib/market/ohlcv');
    const closesBySymbol = new Map<string, Map<string, number>>();
    const allDates = new Set<string>();

    await Promise.all(
      [...symbols].map(async (sym) => {
        const candles = await fetchOhlcv(sym, { resolution: 'D', days: 400, range: '1Y' });
        const m = new Map<string, number>();
        for (const c of candles) {
          const d = new Date(c.time * 1000);
          const key = d.toISOString().slice(0, 10);
          m.set(key, c.close);
          allDates.add(key);
        }
        closesBySymbol.set(sym, m);
      })
    );

    const dates = [...allDates].sort();
    if (dates.length < 6) {
      return {
        success: true,
        data: {
          enough_history: false,
          message: 'Not enough market history to build a tear sheet yet.',
          metrics: {},
          monthly_returns: {},
          drawdown_series: [],
          equity_series: [],
        },
      };
    }

    // Start NAV series a few days before first trade (or earliest date)
    const firstTradeDay = trades[0]
      ? new Date(trades[0].timestamp).toISOString().slice(0, 10)
      : dates[0];
    const startIdx = Math.max(0, dates.findIndex((d) => d >= firstTradeDay) - 5);
    const window = dates.slice(startIdx);

    let cash = initialCash;
    const qty = new Map<string, number>();
    let tradeIdx = 0;
    const equitySeries: { t: string; v: number }[] = [];
    const returnsMap: Record<string, number> = {};
    let prevNav: number | null = null;

    const lastClose = (sym: string, day: string): number | null => {
      const m = closesBySymbol.get(sym);
      if (!m) return null;
      if (m.has(day)) return m.get(day)!;
      return null;
    };

    for (const day of window) {
      while (
        tradeIdx < trades.length &&
        new Date(trades[tradeIdx].timestamp).toISOString().slice(0, 10) <= day
      ) {
        const t = trades[tradeIdx];
        const sym = t.symbol.toUpperCase();
        const q = Number(t.quantity) || 0;
        const total = Number(t.total) || Number(t.price) * q;
        if (t.side === 'buy') {
          cash -= total;
          qty.set(sym, (qty.get(sym) || 0) + q);
        } else {
          cash += total;
          qty.set(sym, Math.max(0, (qty.get(sym) || 0) - q));
        }
        tradeIdx += 1;
      }

      let equity = cash;
      for (const [sym, q] of qty) {
        if (q <= 0) continue;
        const px = lastClose(sym, day);
        if (px != null) equity += q * px;
        else equity += q * (Number(trades.find((x) => x.symbol.toUpperCase() === sym)?.price) || 0);
      }

      equitySeries.push({ t: day, v: equity });
      if (prevNav != null && prevNav > 0) {
        returnsMap[day] = (equity - prevNav) / prevNav;
      }
      prevNav = equity;
    }

    const returnDays = Object.keys(returnsMap).length;
    if (returnDays < 5) {
      return {
        success: true,
        data: {
          enough_history: false,
          message: 'Need ~5+ trading days of paper history for tear-sheet metrics.',
          metrics: {},
          monthly_returns: {},
          drawdown_series: [],
          equity_series: equitySeries,
          day_count: returnDays,
        },
      };
    }

    const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
    const secret = process.env.INTERNAL_API_SECRET || '';

    const res = await fetch(`${fastApiUrl}/quant/tearsheet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': secret,
      },
      body: JSON.stringify({
        returns: returnsMap,
        benchmark: 'SPY',
        title: 'Paper portfolio',
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      return {
        success: true,
        data: {
          enough_history: false,
          message: 'QuantStats service unavailable — showing equity estimate only.',
          metrics: {},
          monthly_returns: {},
          drawdown_series: [],
          equity_series: equitySeries,
          day_count: returnDays,
        },
      };
    }

    const data = await res.json();
    return {
      success: true,
      data: {
        enough_history: Boolean(data.enough_history),
        message: data.message,
        metrics: data.metrics ?? {},
        monthly_returns: data.monthly_returns ?? {},
        drawdown_series: data.drawdown_series ?? [],
        equity_series: equitySeries,
        day_count: data.day_count ?? returnDays,
      },
    };
  } catch {
    return { success: false, message: 'Failed to build portfolio tear sheet' };
  }
}
