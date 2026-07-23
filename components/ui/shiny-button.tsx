'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Adapted from 21st.dev Shiny Button (dillionverma / Magic UI)
 * Tuned for Signalist: #0A0A0A / #141414 / amber #FDD458
 */
interface ShinyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

export function ShinyButton({ children, className, ...props }: ShinyButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'shiny-btn relative overflow-hidden rounded-2xl bg-[#141414] px-6 py-2.5 font-semibold text-sm text-[#FDD458]',
        'border border-[rgba(253,212,88,0.35)] transition-shadow duration-300',
        'hover:shadow-[0_0_20px_rgba(253,212,88,0.2)]',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    >
      <span className="relative z-10">{children}</span>
      <span
        aria-hidden
        className="shiny-btn-sheen pointer-events-none absolute inset-0 z-0"
      />
    </button>
  );
}
