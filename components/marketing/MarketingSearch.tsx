'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Marketing search — adapted from P0 Command palette prompt.
 * Public: search → sign-in with callback to stock/dashboard.
 */

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const POPULAR = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'META', name: 'Meta Platforms' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'AMD', name: 'Advanced Micro Devices' },
];

type Item = { id: string; label: string; hint: string; href: string };

export function MarketingSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const items: Item[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const stocks = POPULAR.filter(
      (s) => !q || s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    ).map((s) => ({
      id: s.symbol,
      label: `${s.symbol} · ${s.name}`,
      hint: 'Open after sign in',
      href: `/sign-in?callbackUrl=${encodeURIComponent(`/stocks/${s.symbol}`)}`,
    }));
    const actions: Item[] = [
      {
        id: 'signup',
        label: 'Create free account',
        hint: 'Start free',
        href: '/sign-up',
      },
      {
        id: 'signin',
        label: 'Sign in to Signalist',
        hint: 'Existing account',
        href: '/sign-in',
      },
      {
        id: 'dash',
        label: 'Go to dashboard',
        hint: 'Requires session',
        href: '/sign-in?callbackUrl=%2Fdashboard',
      },
    ].filter((a) => !q || a.label.toLowerCase().includes(q));
    return [...stocks, ...actions];
  }, [query]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((v) => Math.min(items.length - 1, v + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((v) => Math.max(0, v - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[active];
      if (item) go(item.href);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'press flex h-9 items-center gap-2 rounded-lg px-2.5 text-[14px] text-ink-2 hover:bg-surface-2 hover:text-ink',
          className
        )}
      >
        <Search className="size-3.5" strokeWidth={1.5} />
        <span>Search</span>
      </button>

      {mounted &&
        createPortal(
          <div
            aria-hidden={!open}
            className={cn(
              'fixed inset-0 z-[100]',
              open ? 'pointer-events-auto' : 'pointer-events-none'
            )}
          >
            <motion.div
              initial={false}
              animate={{ opacity: open ? 1 : 0 }}
              transition={{ duration: open ? 0.18 : 0.12, ease: EASE_OUT }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/65"
            />
            <div className="pointer-events-none absolute inset-0 flex items-start justify-center p-4 pt-[18vh]">
              <motion.div
                role="dialog"
                aria-modal
                aria-labelledby={uid}
                initial={false}
                animate={{
                  opacity: open ? 1 : 0,
                  y: open || reduce ? 0 : -8,
                  scale: open || reduce ? 1 : 0.97,
                }}
                transition={{ type: 'spring', stiffness: 560, damping: 40, mass: 0.5 }}
                className={cn(
                  'pointer-events-auto w-full max-w-lg overflow-hidden rounded-lg border border-line-strong bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.55)]',
                  !open && 'invisible'
                )}
              >
                <div className="flex items-center gap-2 border-b border-line px-3">
                  <Search className="size-4 text-ink-3" />
                  <input
                    ref={inputRef}
                    id={uid}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActive(0);
                    }}
                    onKeyDown={onKeyDown}
                    placeholder="Search symbols or jump…"
                    className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
                  />
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded border border-line-strong px-1.5 py-0.5 text-[12px] text-ink-3 hover:text-ink-2"
                  >
                    Close
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto p-2">
                  {items.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-ink-3">No results</div>
                  ) : (
                    items.map((item, i) => (
                      <button
                        key={item.id}
                        type="button"
                        data-index={i}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(item.href)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition',
                          i === active
                            ? 'bg-surface-2 text-ink'
                            : 'text-ink-2 hover:bg-surface-2/60'
                        )}
                      >
                        <span>{item.label}</span>
                        <span className="text-[12px] text-ink-3">{item.hint}</span>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
