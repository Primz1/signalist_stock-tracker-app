'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { createContext, memo, useContext, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/** 21st.dev @haydenbleasel/ticker — Signalist-skinned. */

type TickerContextValue = { formatter: Intl.NumberFormat };

const DEFAULT_CURRENCY = 'USD';
const DEFAULT_LOCALE = 'en-US';

const defaultFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  style: 'currency',
  currency: DEFAULT_CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const TickerContext = createContext<TickerContextValue>({
  formatter: defaultFormatter,
});

export const useTickerContext = () => useContext(TickerContext);

export type TickerProps = HTMLAttributes<HTMLButtonElement> & {
  currency?: string;
  locale?: string;
  children: ReactNode;
};

export const Ticker = memo(
  ({ children, className, currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE, ...props }: TickerProps) => {
    const formatter = useMemo(() => {
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: currency.toUpperCase(),
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      } catch {
        return defaultFormatter;
      }
    }, [currency, locale]);

    return (
      <TickerContext.Provider value={{ formatter }}>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 whitespace-nowrap align-middle text-[#F5F5F5]',
            className
          )}
          {...props}
        >
          {children}
        </button>
      </TickerContext.Provider>
    );
  }
);
Ticker.displayName = 'Ticker';

export type TickerIconProps = HTMLAttributes<HTMLDivElement> & {
  src?: string;
  symbol?: string;
  asChild?: boolean;
  children?: ReactNode;
};

export const TickerIcon = memo(({ src, symbol, className, asChild, children }: TickerIconProps) => {
  if (asChild) {
    return (
      <div className={cn('overflow-hidden rounded-full border border-[#2E2E2E] bg-[#1C1C1C]', className)}>
        {children}
      </div>
    );
  }

  return (
    <Avatar className={cn('size-7 border border-[#2E2E2E] bg-[#1C1C1C]', className)}>
      {src ? <AvatarImage src={src} alt={symbol ?? ''} /> : null}
      <AvatarFallback className="bg-[#1C1C1C] text-[10px] font-semibold text-[#A1A1A1]">
        {symbol?.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
});
TickerIcon.displayName = 'TickerIcon';

export type TickerSymbolProps = HTMLAttributes<HTMLSpanElement> & { symbol: string };

export const TickerSymbol = memo(({ symbol, className, ...props }: TickerSymbolProps) => (
  <span className={cn('mono text-[13px] font-medium text-[#F5F5F5]', className)} {...props}>
    {symbol.toUpperCase()}
  </span>
));
TickerSymbol.displayName = 'TickerSymbol';

export type TickerPriceProps = HTMLAttributes<HTMLSpanElement> & { price: number };

export const TickerPrice = memo(({ price, className, ...props }: TickerPriceProps) => {
  const context = useTickerContext();
  const formattedPrice = useMemo(() => context.formatter.format(price), [price, context]);

  return (
    <span className={cn('mono text-[13px] text-[#A1A1A1]', className)} {...props}>
      {formattedPrice}
    </span>
  );
});
TickerPrice.displayName = 'TickerPrice';

export type TickerPriceChangeProps = HTMLAttributes<HTMLSpanElement> & {
  change: number;
  isPercent?: boolean;
};

export const TickerPriceChange = memo(
  ({ change, isPercent = true, className, ...props }: TickerPriceChangeProps) => {
    const isPositiveChange = change >= 0;
    const context = useTickerContext();
    const changeFormatted = useMemo(() => {
      if (isPercent) return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
      return context.formatter.format(change);
    }, [change, isPercent, context]);

    return (
      <span
        className={cn(
          'mono flex items-center gap-0.5 text-[12px]',
          isPositiveChange ? 'text-[#22C55E]' : 'text-[#EF4444]',
          className
        )}
        {...props}
      >
        <svg
          aria-hidden
          className={isPositiveChange ? '' : 'rotate-180'}
          fill="currentColor"
          height="10"
          viewBox="0 0 24 24"
          width="10"
        >
          <path d="M24 22h-24l12-20z" />
        </svg>
        {changeFormatted}
      </span>
    );
  }
);
TickerPriceChange.displayName = 'TickerPriceChange';
