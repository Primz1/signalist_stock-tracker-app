import type { BarSeries } from './series';
import type { MarketContextClass } from './types';

/**
 * Separates "everything is up" from "this asset is up". Deterministic, so the AI only
 * ever explains a classification it was given.
 */

/** Benchmarks per asset. Stocks compare with SPY and QQQ plus a sector ETF; altcoins with BTC. */
export const MARKET_BENCHMARKS = ['SPY', 'QQQ'] as const;
export const CRYPTO_BENCHMARK = 'BTCUSDT';

/** Finnhub's `finnhubIndustry` values mapped to a liquid sector ETF. */
export const SECTOR_ETFS: Record<string, string> = {
  Semiconductors: 'SMH',
  Technology: 'XLK',
  Software: 'IGV',
  'Communications': 'XLC',
  Media: 'XLC',
  Banking: 'XLF',
  'Financial Services': 'XLF',
  Insurance: 'XLF',
  Energy: 'XLE',
  'Oil & Gas': 'XLE',
  Pharmaceuticals: 'XLV',
  Biotechnology: 'XBI',
  'Health Care': 'XLV',
  Retail: 'XRT',
  'Consumer products': 'XLY',
  Automobiles: 'XLY',
  'Aerospace & Defense': 'ITA',
  Utilities: 'XLU',
  'Real Estate': 'XLRE',
  Industrials: 'XLI',
  Machinery: 'XLI',
  Airlines: 'JETS',
};

export const CONTEXT_SETTINGS = {
  minBenchmarkMovePct: 0.25,
  minAssetSpecificGapPct: 0.75,
} as const;

export type ContextReading = {
  /** Asset move over the window, percent. */
  assetChangePct: number;
  marketChangePct?: number;
  marketSymbol?: string;
  sectorChangePct?: number;
  sectorSymbol?: string;
  windowMinutes: number;
};

export function classifyContext(reading: ContextReading): MarketContextClass {
  const { assetChangePct: asset, marketChangePct: market, sectorChangePct: sector } = reading;
  if (!Number.isFinite(asset) || (market == null && sector == null)) return 'unknown';

  const sameSign = (a: number, b: number) => Math.sign(a) === Math.sign(b) && a !== 0;
  // A benchmark only "drives" a move if it moved itself
  const moved = (b: number | undefined): b is number => b != null && Math.abs(b) >= CONTEXT_SETTINGS.minBenchmarkMovePct;
  // "Close" means within half a point, or within the benchmark's own move if that is larger
  const near = (a: number, b: number) => Math.abs(a - b) < Math.max(0.5, Math.abs(b));

  if (moved(market) && sameSign(asset, market) && near(asset, market)) return 'market-driven';
  if (moved(sector) && sameSign(asset, sector) && near(asset, sector)) return 'sector-driven';
  const reference = sector ?? market!;
  const gap = Math.abs(asset - reference);
  if (gap >= Math.max(CONTEXT_SETTINGS.minAssetSpecificGapPct, 2 * Math.abs(reference))) return 'asset-specific';
  return 'mixed';
}

/** Percent change over the `minutes` before `time`, within one session. Undefined if the bars aren't there. */
export function changeBefore(series: BarSeries, time: number, minutes: number): number | undefined {
  const end = lastIndexAtOrBefore(series, time);
  if (end < 0) return undefined;
  const startTime = series.bars[end].time - minutes * 60;
  let start = end;
  while (start > 0 && series.bars[start - 1].time >= startTime && series.session[start - 1] === series.session[end]) start--;
  if (start === end) return undefined;
  const from = series.bars[start].close;
  return from ? ((series.bars[end].close - from) / from) * 100 : undefined;
}

export function lastIndexAtOrBefore(series: BarSeries, time: number) {
  let lo = 0;
  let hi = series.bars.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series.bars[mid].time <= time) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

export type BenchmarkSeries = { market?: BarSeries; sector?: BarSeries };

export function readContext(asset: BarSeries, i: number, benchmarks: BenchmarkSeries, windowMinutes = 60): ContextReading {
  const time = asset.bars[i].time;
  return {
    assetChangePct: changeBefore(asset, time, windowMinutes) ?? NaN,
    marketChangePct: benchmarks.market ? changeBefore(benchmarks.market, time, windowMinutes) : undefined,
    marketSymbol: benchmarks.market?.symbol,
    sectorChangePct: benchmarks.sector ? changeBefore(benchmarks.sector, time, windowMinutes) : undefined,
    sectorSymbol: benchmarks.sector?.symbol,
    windowMinutes,
  };
}
