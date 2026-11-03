import { describe, expect, it } from 'vitest';
import { binanceSymbol, isCryptoSymbol, isValidSymbol, splitCryptoPair, yahooCryptoSymbol } from './symbols';

describe('symbol rules', () => {
  it('classifies crypto pairs the same way everywhere', () => {
    expect(isCryptoSymbol('BTCUSDT')).toBe(true);
    expect(isCryptoSymbol('BTCUSD')).toBe(true);
    expect(isCryptoSymbol('BINANCE:ETHUSDT')).toBe(true);
    expect(isCryptoSymbol('NVDA')).toBe(false);
    expect(isCryptoSymbol('AAPL')).toBe(false);
  });

  it('splits pairs and maps them to each vendor', () => {
    expect(splitCryptoPair('SOLUSDT')).toEqual({ base: 'SOL', quote: 'USDT' });
    expect(yahooCryptoSymbol('BTCUSDT')).toBe('BTC-USD');
    expect(yahooCryptoSymbol('ETHBTC')).toBeNull();
    expect(binanceSymbol('BTCUSD')).toBe('BTCUSDT');
    expect(binanceSymbol('BTCUSDT')).toBe('BTCUSDT');
  });

  it('rejects input that is not a ticker', () => {
    expect(isValidSymbol('NVDA')).toBe(true);
    expect(isValidSymbol('BRK.B')).toBe(true);
    expect(isValidSymbol('nvda')).toBe(true);
    expect(isValidSymbol('')).toBe(false);
    expect(isValidSymbol('NV DA')).toBe(false);
    expect(isValidSymbol('<script>')).toBe(false);
    expect(isValidSymbol('A'.repeat(21))).toBe(false);
  });
});
