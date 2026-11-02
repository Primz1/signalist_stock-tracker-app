import { describe, it, expect } from 'vitest';
import { selectPollSymbols } from './poll-symbols';

describe('selectPollSymbols', () => {
  it('puts alert symbols first without duplicates', () => {
    expect(selectPollSymbols(['AAPL', 'AAPL'], ['AAPL', 'MSFT'], 0)).toEqual(['AAPL', 'MSFT']);
  });

  it('counts alert symbols as two calls against the budget', () => {
    const tracked = Array.from({ length: 20 }, (_, i) => `S${i}`);
    expect(selectPollSymbols(['A', 'B'], tracked, 0, 10)).toHaveLength(8);
  });

  it('rotates so every tracked symbol gets a turn', () => {
    const tracked = ['A', 'B', 'C', 'D', 'E'];
    const seen = new Set([0, 1, 2].flatMap((tick) => selectPollSymbols([], tracked, tick, 2)));
    expect(seen).toEqual(new Set(tracked));
  });

  it('handles nothing to poll', () => {
    expect(selectPollSymbols([], [], 5)).toEqual([]);
  });
});
