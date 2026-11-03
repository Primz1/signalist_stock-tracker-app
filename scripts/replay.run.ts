/**
 * Replays recent real 1-minute bars through the signal engine and prints what it finds.
 *
 *   REPLAY_SYMBOL=NVDA npm run replay              (bash)
 *   $env:REPLAY_SYMBOL='BTCUSDT'; npm run replay   (PowerShell)
 *   REPLAY_DAYS sets how many days of stock bars to load (max 7)
 *
 * Read-only: fetches candles and writes nothing to the database.
 */
import { it } from 'vitest';
import { config } from 'dotenv';
import { replay } from '@/lib/intelligence/replay';
import { signalTitle } from '@/lib/intelligence/scoring';
import { isConfirmed } from '@/lib/intelligence/signal-engine';
import { marketData } from '@/lib/market/service';
import { isCryptoSymbol, normalizeMarketSymbol } from '@/lib/market/symbols';

config({ path: '.env', quiet: true });

const symbol = normalizeMarketSymbol(process.env.REPLAY_SYMBOL ?? process.env.npm_config_symbol ?? 'NVDA');
const days = Number(process.env.REPLAY_DAYS ?? process.env.npm_config_days ?? 5);

const time = (seconds: number) => new Date(seconds * 1000).toISOString().replace('T', ' ').slice(0, 16);

it(`replay ${symbol}`, { timeout: 120_000 }, async () => {
  const crypto = isCryptoSymbol(symbol);
  const to = Math.floor(Date.now() / 1000);
  const from = to - (crypto ? 1 : days) * 86_400;
  const benchmark = crypto ? (symbol === 'BTCUSDT' ? undefined : 'BTCUSDT') : 'SPY';
  const [asset, market] = await Promise.all([
    marketData.getCandles(symbol, '1m', { from, to }),
    benchmark ? marketData.getCandles(benchmark, '1m', { from, to }) : undefined,
  ]);
  if (!asset.candles.length) throw new Error(`No candles for ${symbol}`);

  // The first session (or first 6 hours of crypto) only warms up the indicators
  const warmup = crypto ? 360 : asset.candles.findIndex((b, i) => i > 0 && b.time - asset.candles[i - 1].time > 3600);
  const result = replay({
    symbol,
    assetType: crypto ? 'crypto' : 'stock',
    bars: asset.candles,
    benchmarks: market?.candles.length ? { market: { symbol: benchmark!, bars: market.candles } } : undefined,
    startIndex: Math.max(0, warmup),
  });

  const lines = [
    `${symbol}: ${asset.candles.length} bars from ${asset.source}, ${time(asset.candles[0].time)} to ${time(asset.candles.at(-1)!.time)} UTC`,
    `Events: ${result.events.length}`,
    ...Object.entries(
      result.events.reduce<Record<string, number>>((acc, e) => ({ ...acc, [`${e.eventType} ${e.direction}`]: (acc[`${e.eventType} ${e.direction}`] ?? 0) + 1 }), {})
    ).map(([k, n]) => `  ${k}: ${n}`),
    `Signals: ${result.signals.length}, confirmed and shown to users: ${result.signals.filter(isConfirmed).length}`,
  ];
  for (const s of result.signals) {
    lines.push(
      `  ${isConfirmed(s) ? '●' : '○'} ${time(s.startedAt)}  ${signalTitle(s.type, s.score.direction)}  strength ${s.score.strength} (peak ${s.peakStrength})  confidence ${s.score.confidence}  ${s.status}  context ${s.score.context}`
    );
    for (const h of s.history) lines.push(`      ${time(h.at)}  ${h.status}  ${h.note}`);
  }
  // Vitest hides console output from passing tests
  process.stdout.write(`\n${lines.join('\n')}\n\n`);
});
