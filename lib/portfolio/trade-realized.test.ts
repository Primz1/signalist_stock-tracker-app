import { describe, expect, it } from 'vitest';
import { computeRealizedByTradeId } from './trade-realized';

describe('computeRealizedByTradeId', () => {
  it('backfills realized P/L for legacy sells using running avg cost', () => {
    const byId = computeRealizedByTradeId([
      {
        id: '1',
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        price: 100,
        timestamp: '2024-01-01T00:00:00.000Z',
      },
      {
        id: '2',
        symbol: 'AAPL',
        side: 'buy',
        quantity: 10,
        price: 120,
        timestamp: '2024-01-02T00:00:00.000Z',
      },
      {
        id: '3',
        symbol: 'AAPL',
        side: 'sell',
        quantity: 5,
        price: 130,
        timestamp: '2024-01-03T00:00:00.000Z',
        // legacy: no avgCostAtSale / realizedPl
      },
    ]);

    // avg cost after two buys: (10*100 + 10*120) / 20 = 110
    expect(byId.get('3')).toEqual({ avgCostAtSale: 110, realizedPl: 100 });
  });

  it('prefers stored realizedPl when present', () => {
    const byId = computeRealizedByTradeId([
      {
        id: '1',
        symbol: 'TSLA',
        side: 'buy',
        quantity: 2,
        price: 200,
        timestamp: '2024-01-01T00:00:00.000Z',
      },
      {
        id: '2',
        symbol: 'TSLA',
        side: 'sell',
        quantity: 2,
        price: 250,
        timestamp: '2024-01-02T00:00:00.000Z',
        avgCostAtSale: 200,
        realizedPl: 99, // stored wins over recomputed 100
      },
    ]);

    expect(byId.get('2')?.realizedPl).toBe(99);
  });

  it('skips undone trades when reconstructing positions', () => {
    const byId = computeRealizedByTradeId([
      {
        id: '1',
        symbol: 'MSFT',
        side: 'buy',
        quantity: 10,
        price: 50,
        timestamp: '2024-01-01T00:00:00.000Z',
      },
      {
        id: '2',
        symbol: 'MSFT',
        side: 'sell',
        quantity: 10,
        price: 60,
        timestamp: '2024-01-02T00:00:00.000Z',
        undoneAt: '2024-01-02T00:01:00.000Z',
      },
      {
        id: '3',
        symbol: 'MSFT',
        side: 'sell',
        quantity: 5,
        price: 70,
        timestamp: '2024-01-03T00:00:00.000Z',
      },
    ]);

    expect(byId.has('2')).toBe(false);
    expect(byId.get('3')).toEqual({ avgCostAtSale: 50, realizedPl: 100 });
  });

  it('does not attach realized values for buys', () => {
    const byId = computeRealizedByTradeId([
      {
        id: '1',
        symbol: 'NVDA',
        side: 'buy',
        quantity: 1,
        price: 400,
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    ]);
    expect(byId.has('1')).toBe(false);
  });
});
