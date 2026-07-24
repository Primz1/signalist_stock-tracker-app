'use client';

import { cn } from '@/lib/utils';

/** Claude Design / prototype hero glow — breathe animation */
export function AmbientGlow({
  className,
  size = 520,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute animate-breathe hero-glow', className)}
      style={{ width: size, height: size }}
    />
  );
}

/** Soft amber mesh blobs for auth / marketing atmosphere (21st SVG gradient, Signalist-colored) */
export function AmberMeshBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div
        className="absolute -left-[10%] -top-[20%] h-[70%] w-[70%] rounded-full opacity-40 blur-3xl animate-bg-gradient"
        style={
          {
            background:
              'radial-gradient(circle, rgba(249,115,22,0.28) 0%, rgba(253,212,88,0.08) 40%, transparent 70%)',
            '--background-gradient-speed': '10s',
            '--tx-1': 0.2,
            '--ty-1': -0.1,
            '--tx-2': -0.15,
            '--ty-2': 0.2,
            '--tx-3': 0.1,
            '--ty-3': 0.15,
          } as React.CSSProperties
        }
      />
      <div
        className="absolute -bottom-[15%] -right-[10%] h-[55%] w-[55%] rounded-full opacity-30 blur-3xl animate-bg-gradient"
        style={
          {
            background:
              'radial-gradient(circle, rgba(253,212,88,0.2) 0%, rgba(124,45,18,0.12) 45%, transparent 70%)',
            '--background-gradient-speed': '12s',
            '--tx-1': -0.15,
            '--ty-1': 0.2,
            '--tx-2': 0.25,
            '--ty-2': -0.1,
            '--tx-3': -0.05,
            '--ty-3': -0.2,
          } as React.CSSProperties
        }
      />
    </div>
  );
}
