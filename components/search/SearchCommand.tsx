"use client"

import { MouseEvent, useEffect, useMemo, useState } from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command"
import { Loader2, Search, Star } from "lucide-react"
import { searchStocks } from "@/lib/actions/finnhub.actions"
import { addToWatchlist } from "@/lib/actions/watchlist.actions"
import { useDebounce } from "@/hooks/useDebounce"
import clsx from "clsx"
import Link from "next/link"
import { notify } from "@/lib/notify"

type SearchCommandProps = {
  renderAs?: "button" | "text" | "icon" | "modal";
  label?: string;
  initialStocks: StockWithWatchlistStatus[];
  watchlistSymbols?: string[];
  onSelectStock?: (stock: StockWithWatchlistStatus) => Promise<void> | void;
  mode?: "link" | "add";
  quickAddEnabled?: boolean;
  onQuickAdd?: (stock: StockWithWatchlistStatus) => Promise<boolean> | Promise<void> | void;
  className?: string;
  /** Compact pill style without search icon */
  pill?: boolean;
};

const RECENT_STOCKS_KEY = 'signalist_recent_stocks'
const MAX_RECENT_STOCKS = 10

export function SearchCommand({ renderAs = 'button', label = 'Add stock', initialStocks, watchlistSymbols, onSelectStock, mode, quickAddEnabled, onQuickAdd, className, pill }: SearchCommandProps) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<StockWithWatchlistStatus[]>(initialStocks)
  const [recentStocks, setRecentStocks] = useState<StockWithWatchlistStatus[]>(initialStocks.slice(0, MAX_RECENT_STOCKS))
  const [addingSymbol, setAddingSymbol] = useState<string | null>(null)
  const [localWatchlistSet, setLocalWatchlistSet] = useState<Set<string>>(new Set())

  const isSearchMode = !!searchTerm.trim();
  const displayStocks = isSearchMode ? searchResults : recentStocks;


  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])


  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(RECENT_STOCKS_KEY) : null;
      if (stored) {
        const parsed = JSON.parse(stored) as StockWithWatchlistStatus[];
        if (Array.isArray(parsed)) {
          setRecentStocks(parsed.slice(0, MAX_RECENT_STOCKS));
          setSearchResults(initialStocks);
          return;
        }
      }
    } catch (error) {
      console.warn('Failed to load recent stocks from storage', error);
    }

    setRecentStocks(initialStocks.slice(0, MAX_RECENT_STOCKS));
    setSearchResults(initialStocks);
  }, [initialStocks])

  useEffect(() => {
    if (!watchlistSymbols) return;
    const set = new Set(watchlistSymbols.map((s) => s.toUpperCase()))
    setLocalWatchlistSet(set);
    setRecentStocks((prev) => prev.map((item) => ({ ...item, isInWatchlist: set.has(item.symbol) })))
    setSearchResults((prev) => prev.map((item) => ({ ...item, isInWatchlist: set.has(item.symbol) })))
  }, [watchlistSymbols])


  const handleSearch = async () => {
    if(!isSearchMode) {
      setSearchResults(initialStocks);
      return;
    }

    setLoading(true);
    try {
      const results = await searchStocks(searchTerm.trim(), watchlistSymbols);
      setSearchResults(results);
    } catch {
      setSearchResults([])
    } finally {
      setLoading(false);
    }

  }


  const debouncedSearch = useDebounce(handleSearch, 300);
  
  useEffect(() => {
    debouncedSearch();
  }, [searchTerm]);


  const persistRecentStocks = (items: StockWithWatchlistStatus[]) => {
    setRecentStocks(items);
    try {
      localStorage.setItem(RECENT_STOCKS_KEY, JSON.stringify(items));
    } catch (error) {
      console.warn('Failed to save recent stocks', error);
    }
  }

  const handleSelectStock = async (stock: StockWithWatchlistStatus, e?: MouseEvent) => {
    if (onSelectStock) {
      e?.preventDefault();
      setAddingSymbol(stock.symbol);
      try {
        await onSelectStock(stock);
      } finally {
        setAddingSymbol(null);
      }
    }

    setOpen(false)
    setSearchTerm("");
    setSearchResults(initialStocks);
    const next = [stock, ...recentStocks.filter((item) => item.symbol !== stock.symbol)].slice(0, MAX_RECENT_STOCKS);
    persistRecentStocks(next);

    // mark as in-watchlist locally
    setLocalWatchlistSet((prev) => {
      const copy = new Set(prev);
      copy.add(stock.symbol.toUpperCase());
      setRecentStocks((cur) => cur.map((item) => item.symbol === stock.symbol ? { ...item, isInWatchlist: true } : item));
      setSearchResults((cur) => cur.map((item) => item.symbol === stock.symbol ? { ...item, isInWatchlist: true } : item));
      return copy;
    });
  }

  const handleQuickAdd = async (stock: StockWithWatchlistStatus, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAddingSymbol(stock.symbol);
    try {
      let ok = true;
      if (onQuickAdd) {
        const res = await onQuickAdd(stock);
        if (res === false) ok = false;
      } else {
        const res = await addToWatchlist(stock.symbol, stock.name);
        if (!res.success) {
          notify.watchlistFailed('add', res.message);
          ok = false;
        }
      }
      if (ok) {
        setLocalWatchlistSet((prev) => {
          const copy = new Set(prev);
          copy.add(stock.symbol.toUpperCase());
          setRecentStocks((cur) => cur.map((item) => item.symbol === stock.symbol ? { ...item, isInWatchlist: true } : item));
          setSearchResults((cur) => cur.map((item) => item.symbol === stock.symbol ? { ...item, isInWatchlist: true } : item));
          return copy;
        });
        notify.watchlistAdded(stock.symbol);
      }
    } catch (error) {
      notify.watchlistFailed('add', error instanceof Error ? error.message : undefined);
    } finally {
      setAddingSymbol(null);
    }
  };

  const watchlistSet = useMemo(() => {
    if (localWatchlistSet.size) return localWatchlistSet;
    return new Set(watchlistSymbols?.map((s) => s.toUpperCase()) ?? []);
  }, [localWatchlistSet, watchlistSymbols]);

  const resolvedMode: "link" | "add" = onSelectStock ? mode || "add" : "link";

  return (
    <>
      {renderAs === 'text' && (
        <span onClick={() => setOpen(true)} className="search-text">
          {label}
        </span>
      )}
      {renderAs === 'button' && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!!addingSymbol}
          aria-busy={!!addingSymbol}
          className={clsx(
            'search-btn inline-flex w-full max-w-[280px] cursor-pointer items-center gap-2 rounded-lg border border-[#2E2E2E] bg-[#0A0A0A] px-2.5 py-[7px] text-[13px] font-normal text-[#6E6E6E] hover:bg-[#0A0A0A]',
            className
          )}
        >
          {addingSymbol ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" strokeWidth={1.5} />
          ) : (
            !pill && <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          )}
          <span className="truncate">{label}</span>
        </button>
      )}
      {renderAs === 'modal' && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={clsx(
            'relative inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-[#2E2E2E] bg-[#0A0A0A] p-0 text-[#A1A1A1]',
            'hover:bg-[#1C1C1C] hover:text-[#F5F5F5]',
            'md:border xl:h-9 xl:w-60 xl:justify-start xl:gap-2 xl:px-3 xl:py-2',
            className
          )}
        >
          <Search className="size-4 shrink-0" strokeWidth={1.5} />
          <span className="hidden truncate text-[13px] font-normal text-[#6E6E6E] xl:inline">
            {label || 'Search...'}
          </span>
          <span className="sr-only">Search</span>
        </button>
      )}
      {renderAs === 'icon' && (
        <button
          type="button"
          aria-label={label}
          onClick={() => setOpen(true)}
          className="p-1.5 text-[#A1A1A1] hover:text-[#FDD458]"
        >
          <Search className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>
      )}
      <CommandDialog open={open} onOpenChange={setOpen} className="search-dialog">
          <div className="search-field">
            <CommandInput value={searchTerm} onValueChange={setSearchTerm} placeholder="Search stocks..." className="search-input" />
            {loading && <Loader2 className="search-loader" />}
          </div>
        <CommandList className="search-list">
          {loading ?(
            <CommandEmpty className="search-list-empty">Loading stocks...</CommandEmpty>
          ) : displayStocks?.length === 0 ? (
            <div className="search-list-indicator">
              {isSearchMode
                ? `No matches for '${searchTerm}'. Try a ticker (AAPL) or full name (Apple).`
                : 'No stocks available'}
            </div>
          ) : (
            <ul>
              <div className="search-count">
                {isSearchMode ? 'Search Results': 'Popular Stocks'}
               {`  `}({displayStocks?.length || 0})
              </div>
              {displayStocks?.map((stock) => {
                const monogram = (stock.symbol || '??').slice(0, 2);
                const isCrypto = /crypto/i.test(stock.type);
                const isEtf = /etf|etn/i.test(stock.type);
                const monoClass = isCrypto
                  ? 'bg-[#FB923C]/20 text-[#FB923C]'
                  : isEtf
                    ? 'bg-[#FDD458]/20 text-[#FDD458]'
                    : 'bg-[#F59E0B]/20 text-[#F59E0B]';
                return (
                <li key={`${stock.symbol}-${stock.exchange}`} className="search-item">
                  {resolvedMode === "add" ? (
                    <button
                      className="search-item-link"
                      onClick={(e) => handleSelectStock(stock, e)}
                      disabled={addingSymbol === stock.symbol}
                    >
                      <span className={clsx('inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold', monoClass)}>
                        {monogram}
                      </span>
                      <div className="flex-1 text-left">
                        <div className="search-item-name flex items-center gap-2">
                          {stock.name}
                          {(stock.isInWatchlist || watchlistSet.has(stock.symbol)) && (
                            <span className="rounded border border-[#FDD458]/40 px-1.5 py-[1px] text-[10px] text-[#FDD458]">
                              In watchlist
                            </span>
                          )}
                        </div>
                        <div className="mono text-[12px] text-[#6E6E6E]">
                          {stock.symbol} · {stock.exchange}
                        </div>
                      </div>
                      <span className="mr-1 rounded border border-[#2E2E2E] px-1.5 py-0.5 text-[10px] uppercase text-[#A1A1A1]">
                        {isCrypto ? 'crypto' : isEtf ? 'etf' : 'stock'}
                      </span>
                      <span
                        className={clsx(
                          "inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300 transition hover:bg-amber-400/20",
                          addingSymbol === stock.symbol && "opacity-70"
                        )}
                        title="Add to watchlist"
                      >
                        {addingSymbol === stock.symbol ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Star className="h-4 w-4" />
                        )}
                      </span>
                    </button>
                  ) : (
                    <div className="search-item-link">
                      <Link href={`/stocks/${stock.symbol}`} className="flex flex-1 items-center gap-3" onClick={() => handleSelectStock(stock)}>
                        <span className={clsx('inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold', monoClass)}>
                          {monogram}
                        </span>
                        <div className="flex-1 text-left">
                          <div className="search-item-name flex items-center gap-2">
                            {stock.name}
                            {(stock.isInWatchlist || watchlistSet.has(stock.symbol)) && (
                              <span className="rounded border border-[#FDD458]/40 px-1.5 py-[1px] text-[10px] text-[#FDD458]">
                                In watchlist
                              </span>
                            )}
                          </div>
                          <div className="mono text-[12px] text-[#6E6E6E]">
                            {stock.symbol} · {stock.exchange}
                          </div>
                        </div>
                      </Link>
                      <span className="mr-1 rounded border border-[#2E2E2E] px-1.5 py-0.5 text-[10px] uppercase text-[#A1A1A1]">
                        {isCrypto ? 'crypto' : isEtf ? 'etf' : 'stock'}
                      </span>
                      {quickAddEnabled && (
                        <button
                          className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300 transition hover:bg-amber-400/20 disabled:opacity-60"
                          onClick={(e) => handleQuickAdd(stock, e)}
                          disabled={addingSymbol === stock.symbol}
                          aria-busy={addingSymbol === stock.symbol}
                          title="Add to watchlist"
                        >
                          {addingSymbol === stock.symbol ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Star className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      {!quickAddEnabled && (
                        <span className="text-xs font-medium text-amber-400">Open</span>
                      )}
                    </div>
                  )}
                </li>
                );
              })}
            </ul>
            
          )} 
        </CommandList>
      </CommandDialog>
    </>
  )
}