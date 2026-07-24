'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { EconomicEvent } from '@/lib/actions/economic.actions';

export type { EconomicEvent };

/** P2 Economic Calendar — Signalist amber/charcoal skin. */

const VolatilityIcon = ({ impact }: { impact: EconomicEvent['impact'] }) => {
  const barCount = impact === 'high' ? 3 : impact === 'medium' ? 2 : 1;
  return (
    <div className="flex h-4 items-end gap-0.5" title={`${impact} impact`}>
      {Array.from({ length: 3 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'w-1 rounded-full',
            i === 0 ? 'h-2' : i === 1 ? 'h-3' : 'h-4',
            i < barCount
              ? impact === 'high'
                ? 'bg-[#EF4444]'
                : impact === 'medium'
                  ? 'bg-[#FDD458]'
                  : 'bg-[#A1A1A1]'
              : 'bg-[#2E2E2E]'
          )}
        />
      ))}
    </div>
  );
};

export const EconomicCalendar = React.forwardRef<
  HTMLDivElement,
  {
    title?: string;
    events: EconomicEvent[];
    className?: string;
    seeAllHref?: string;
  }
>(function EconomicCalendar(
  { title = 'Economic calendar', events, className, seeAllHref = '/research' },
  ref
) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(true);
  const reduce = useReducedMotion();

  const handleScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -el.clientWidth * 0.8 : el.clientWidth * 0.8, behavior: 'smooth' });
  };

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    handleScroll();
    el.addEventListener('scroll', handleScroll, { passive: true });
    const ro = new ResizeObserver(handleScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', handleScroll);
      ro.disconnect();
    };
  }, [events, handleScroll]);

  return (
    <div ref={ref} className={cn('w-full', className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="section-title flex items-center gap-1.5">
          {title}
          <ChevronRight className="size-4 text-[#6E6E6E]" />
        </h2>
        <div className="flex items-center gap-1.5">
          {canScrollLeft && (
            <button
              type="button"
              aria-label="Scroll left"
              onClick={() => scroll('left')}
              className="rounded-full border border-[#2E2E2E] bg-[#141414] p-1.5 text-[#A1A1A1] hover:text-[#F5F5F5]"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          {canScrollRight && (
            <button
              type="button"
              aria-label="Scroll right"
              onClick={() => scroll('right')}
              className="rounded-full border border-[#2E2E2E] bg-[#141414] p-1.5 text-[#A1A1A1] hover:text-[#F5F5F5]"
            >
              <ChevronRight className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <motion.div
          className="flex flex-nowrap gap-3"
          initial={reduce ? false : 'hidden'}
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: reduce ? 0 : 0.08 },
            },
          }}
        >
          {events.map((event, index) => (
            <motion.div
              key={`${event.eventName}-${event.time}-${index}`}
              variants={{
                hidden: { y: 12, opacity: 0 },
                visible: {
                  y: 0,
                  opacity: 1,
                  transition: { type: 'spring', stiffness: 320, damping: 28 },
                },
              }}
              className="w-72 flex-none rounded-xl border border-[#242424] bg-[#141414] p-4 transition hover:border-[#FDD458]/35"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[#6E6E6E]">Today</span>
                  <span className="mono rounded-md bg-[rgba(239,68,68,0.12)] px-2 py-0.5 text-[12px] font-semibold text-[#EF4444]">
                    {event.time}
                  </span>
                </div>
                <VolatilityIcon impact={event.impact} />
              </div>

              <div className="mb-4 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://flagcdn.com/w40/${event.countryCode.toLowerCase()}.png`}
                  alt=""
                  className="size-8 rounded-full bg-[#1C1C1C] object-cover"
                />
                <h3 className="truncate text-[14px] font-semibold text-[#F5F5F5]">
                  {event.eventName}
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-1 text-center text-[12px]">
                <div>
                  <p className="text-[#6E6E6E]">Actual</p>
                  <p className="mono mt-1 font-medium text-[#F5F5F5]">
                    {event.actual ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[#6E6E6E]">Forecast</p>
                  <p className="mono mt-1 font-medium text-[#A1A1A1]">
                    {event.forecast ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[#6E6E6E]">Prior</p>
                  <p className="mono mt-1 font-medium text-[#A1A1A1]">
                    {event.prior ?? '—'}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <Link
        href={seeAllHref}
        className="mt-2 inline-block text-[13px] text-[#FDD458] hover:underline"
      >
        See all market events ›
      </Link>
    </div>
  );
});

EconomicCalendar.displayName = 'EconomicCalendar';
