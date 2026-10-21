'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type NewsCardItem = {
  time: string;
  headline: string;
  source: string;
  href?: string;
};

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Auto-cycling market news card (21st.dev) — rethemed to Signalist amber/charcoal.
 */
export function NewsCard({
  items,
  title = 'Market news',
  cycleMs = 5200,
  className,
}: {
  items: NewsCardItem[];
  title?: string;
  cycleMs?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (reduced || items.length <= 1) return;
    timer.current = setInterval(() => setI((n) => (n + 1) % items.length), cycleMs);
    return () => clearInterval(timer.current);
  }, [reduced, items.length, cycleMs]);

  if (!items.length) return null;

  const jump = (n: number) => {
    setI(n);
    if (timer.current) {
      clearInterval(timer.current);
      if (!reduced && items.length > 1) {
        timer.current = setInterval(() => setI((m) => (m + 1) % items.length), cycleMs);
      }
    }
  };

  const item = items[i] ?? items[0];

  const body = (
    <>
      <div className="text-[12px] text-ink-3">{item.time}</div>
      <p className="mt-2 text-[14.5px] font-semibold leading-snug text-ink">
        {item.headline}
      </p>
      <div className="mt-3 text-[12px] text-ink-3">{item.source}</div>
    </>
  );

  return (
    <div className={cn('w-full', className)}>
      <div className="text-[12px] text-ink-3">{title}</div>
      <div className="mt-3 rounded-lg border border-line bg-surface px-5 py-5 shadow-[inset_0_1px_0_0_rgba(245,245,245,0.04)]">
        <div className="relative min-h-[108px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={i}
              initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={reduced ? { duration: 0 } : { duration: 0.35, ease: EASE }}
            >
              {item.href ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block transition-colors hover:[&_p]:text-signal"
                >
                  {body}
                </a>
              ) : (
                body
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {items.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {items.map((_, n) => (
            <button
              key={n}
              type="button"
              aria-label={`Story ${n + 1}`}
              aria-current={n === i}
              onClick={() => jump(n)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                n === i ? 'w-5 bg-signal' : 'w-1.5 bg-line-strong hover:bg-ink-3'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
