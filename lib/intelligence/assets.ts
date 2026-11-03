import { AssetModel } from '@/database/models/asset.model';
import { marketData } from '@/lib/market/service';
import { binanceSymbol, isCryptoSymbol, splitCryptoPair, yahooCryptoSymbol } from '@/lib/market/symbols';
import { CRYPTO_BENCHMARK, MARKET_BENCHMARKS, SECTOR_ETFS } from './context';
import type { AssetType } from './types';

export type AssetInfo = {
  symbol: string;
  name: string;
  assetType: AssetType;
  sector?: string;
  benchmark?: string;
};

const KNOWN_ETFS = new Set([...MARKET_BENCHMARKS, ...Object.values(SECTOR_ETFS), 'DIA', 'IWM', 'VOO', 'VTI', 'ARKK', 'TLT', 'GLD']);

async function describe(symbol: string): Promise<AssetInfo & { exchange?: string; currency: string }> {
  if (isCryptoSymbol(symbol)) {
    const pair = splitCryptoPair(symbol);
    return { symbol, name: pair?.base ?? symbol, assetType: 'crypto', currency: pair?.quote ?? 'USD' };
  }
  if (KNOWN_ETFS.has(symbol)) return { symbol, name: symbol, assetType: 'etf', currency: 'USD' };

  const profile = await marketData.getProfile(symbol);
  const sector = profile?.industry;
  return {
    symbol,
    name: profile?.name ?? symbol,
    // Finnhub has no profile for ETFs
    assetType: profile ? 'stock' : 'etf',
    exchange: profile?.exchange,
    currency: profile?.currency ?? 'USD',
    sector,
    benchmark: sector ? SECTOR_ETFS[sector] : undefined,
  };
}

/** Asset records for the symbols, creating missing ones from provider profiles. */
export async function ensureAssets(symbols: string[]): Promise<Map<string, AssetInfo>> {
  const existing = await AssetModel.find({ symbol: { $in: symbols } }).lean();
  const result = new Map<string, AssetInfo>(
    existing.map((a) => [a.symbol, { symbol: a.symbol, name: a.name, assetType: a.assetType, sector: a.sector, benchmark: a.benchmark }])
  );

  const missing = symbols.filter((s) => !result.has(s));
  const described = await Promise.all(missing.map(describe));
  if (described.length) {
    await AssetModel.bulkWrite(
      described.map((asset) => ({
        updateOne: {
          filter: { symbol: asset.symbol },
          update: {
            $setOnInsert: {
              ...asset,
              providerSymbols: {
                finnhub: asset.assetType === 'crypto' ? `BINANCE:${asset.symbol}` : asset.symbol,
                binance: asset.assetType === 'crypto' ? binanceSymbol(asset.symbol) : undefined,
                yahoo: asset.assetType === 'crypto' ? yahooCryptoSymbol(asset.symbol) ?? undefined : asset.symbol,
              },
              active: true,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
    described.forEach((asset) => result.set(asset.symbol, asset));
  }
  return result;
}

/** Market and sector benchmarks for an asset. BTC has no benchmark of its own. */
export function benchmarksFor(asset: AssetInfo): { market?: string; sector?: string } {
  if (asset.assetType === 'crypto') return asset.symbol === CRYPTO_BENCHMARK ? {} : { market: CRYPTO_BENCHMARK };
  if (asset.symbol === 'SPY') return {};
  return { market: 'SPY', sector: asset.benchmark && asset.benchmark !== asset.symbol ? asset.benchmark : undefined };
}
