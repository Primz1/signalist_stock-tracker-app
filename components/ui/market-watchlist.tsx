'use client';

import { useMemo, useState } from 'react';
import { ChevronDown as CaretDown, ChevronUp as CaretUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/** 21st.dev @ssicevs/market-watchlist — Signalist amber rail + live assets. */

export type WatchlistAsset = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  points: number[];
};

const HAIRLINE = '#242424';
const CHART_UP = '#22C55E';
const CHART_DOWN = '#EF4444';
const ACCENT = '#FDD458';

function Sparkline({ asset }: { asset: WatchlistAsset }) {
  const max = Math.max(...asset.points);
  const min = Math.min(...asset.points);
  const path = asset.points
    .map((value, index) => {
      const x = 2 + (index / (asset.points.length - 1 || 1)) * 76;
      const y = 3 + (1 - (value - min) / (max - min || 1)) * 23;
      return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox="0 0 80 30" className="h-7 w-20" aria-hidden>
      <path
        d={path}
        fill="none"
        stroke={asset.change >= 0 ? CHART_UP : CHART_DOWN}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MarketWatchlist({
  assets,
  className,
}: {
  assets: WatchlistAsset[];
  className?: string;
}) {
  const [sort, setSort] = useState<'symbol' | 'change'>('change');
  const [descending, setDescending] = useState(true);
  const [active, setActive] = useState(assets[0]?.symbol ?? '');

  const rows = useMemo(() => {
    return [...assets].sort((a, b) => {
      const result = sort === 'change' ? a.change - b.change : a.symbol.localeCompare(b.symbol);
      return descending ? -result : result;
    });
  }, [assets, sort, descending]);

  const changeSort = (next: 'symbol' | 'change') => {
    if (sort === next) setDescending((v) => !v);
    else {
      setSort(next);
      setDescending(next === 'change');
    }
  };

  if (!assets.length) return null;

  return (
    <div
      className={cn(
        'h-[220px] w-full overflow-hidden rounded-xl border border-[#242424] bg-[#141414]',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-[#242424] px-4 py-2.5">
        <h3 className="text-[13px] font-semibold text-[#F5F5F5]">Market watchlist</h3>
        <span className="text-[10px] text-[#6E6E6E]">{assets.length} assets · live</span>
      </div>
      <div
        className="grid grid-cols-[minmax(0,1fr)_72px_88px] items-center border-b border-[#242424] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-[#6E6E6E]"
      >
        <button type="button" onClick={() => changeSort('symbol')} className="flex items-center gap-1 text-left">
          Asset {sort === 'symbol' && (descending ? <CaretDown size={10} /> : <CaretUp size={10} />)}
        </button>
        <span className="text-center">Trend</span>
        <button
          type="button"
          onClick={() => changeSort('change')}
          className="flex items-center justify-end gap-1"
        >
          Change {sort === 'change' && (descending ? <CaretDown size={10} /> : <CaretUp size={10} />)}
        </button>
      </div>
      <div className="max-h-[152px] overflow-y-auto">
        {rows.map((asset) => {
          const selected = active === asset.symbol;
          const positive = asset.change >= 0;
          return (
            <button
              key={asset.symbol}
              type="button"
              onClick={() => setActive(asset.symbol)}
              className="grid w-full grid-cols-[minmax(0,1fr)_72px_88px] items-center border-b border-[#1C1C1C] px-4 py-2 text-left transition-colors last:border-b-0 hover:bg-[#1C1C1C]/50"
              style={{ background: selected ? 'rgba(253,212,88,0.06)' : undefined }}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-4 w-[2px] shrink-0 rounded-full"
                  style={{ background: selected ? ACCENT : HAIRLINE }}
                />
                <span className="min-w-0">
                  <span className="mono block text-[12px] font-semibold text-[#F5F5F5]">
                    {asset.symbol}
                  </span>
                  <span className="block truncate text-[10px] text-[#6E6E6E]">{asset.name}</span>
                </span>
              </span>
              <Sparkline asset={asset} />
              <span className="text-right tabular-nums">
                <span className="mono block text-[12px] font-semibold text-[#F5F5F5]">
                  ${asset.price.toFixed(2)}
                </span>
                <span
                  className="mono text-[10px] font-semibold"
                  style={{ color: positive ? CHART_UP : CHART_DOWN }}
                >
                  {positive ? '+' : ''}
                  {asset.change.toFixed(2)}%
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
