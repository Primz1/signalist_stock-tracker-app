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
      <div className="text-[10px] text-[#6E6E6E]">{item.time}</div>
      <p className="mt-2 text-[14.5px] font-semibold leading-snug text-[#F5F5F5]">
        {item.headline}
      </p>
      <div className="mt-3 text-[10px] text-[#6E6E6E]">{item.source}</div>
    </>
  );

  return (
    <div className={cn('w-full', className)}>
      <div className="text-[10px] uppercase tracking-[0.1em] text-[#6E6E6E]">{title}</div>
      <div className="mt-3 rounded-xl border border-[#242424] bg-[#141414] px-5 py-5 shadow-[inset_0_1px_0_0_rgba(245,245,245,0.04)]">
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
                  className="block transition-colors hover:[&_p]:text-[#FDD458]"
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
                n === i ? 'w-5 bg-[#FDD458]' : 'w-1.5 bg-[#2E2E2E] hover:bg-[#6E6E6E]'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
