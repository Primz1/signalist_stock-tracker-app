'use client';

import { NAV_ITEMS } from '@/lib/constants';
import Link from 'next/link';
import { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, LayoutDashboard, Star, PieChart, Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const TAB_ICONS: Record<string, LucideIcon> = {
  '/dashboard': LayoutDashboard,
  '/watchlist': Star,
  '/portfolio': PieChart,
  '/signals': Activity,
  '/research': Sparkles,
};

function NavPendingDot() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      className="ml-2 inline-block size-1 shrink-0 animate-pulse-soft rounded-full bg-ink"
      aria-hidden
    />
  );
}

const NavItems = ({
  className,
  itemClassName,
  variant = 'rail',
}: {
  className?: string;
  itemClassName?: string;
  variant?: 'rail' | 'tabs';
}) => {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (pathname.startsWith('/preview')) {
      const leaf = pathname.split('/').filter(Boolean)[1] || 'dashboard';
      if (path === '/dashboard') return leaf === 'dashboard';
      if (path === '/stocks') return leaf === 'stock';
      return path.replace(/^\//, '') === leaf;
    }
    if (path === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname.startsWith(path);
  };

  if (variant === 'tabs') {
    return (
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid h-16 grid-cols-5">
          {NAV_ITEMS.map(({ href, label }) => {
            const active = isActive(href);
            const Icon = TAB_ICONS[href];
            return (
              <li key={href} className="relative h-full">
                {active && (
                  <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-signal" />
                )}
                <Link
                  href={href}
                  prefetch
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'press hit-slop flex h-full flex-col items-center justify-center gap-1 px-1 text-center text-xs leading-tight',
                    active ? 'font-semibold text-ink' : 'text-ink-3'
                  )}
                >
                  {Icon && <Icon className="size-5" strokeWidth={active ? 2 : 1.5} />}
                  {label}
                  <NavPendingDot />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <ul className={cn('flex h-14 items-center gap-6', className)}>
      {NAV_ITEMS.map(({ href, label }) => {
        const active = isActive(href);
        return (
          <li key={href} className="flex h-full items-center">
            <Link
              href={href}
              prefetch
              aria-current={active ? 'page' : undefined}
              className={cn(
                'press relative inline-flex h-14 items-center whitespace-nowrap text-sm after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:rounded-full after:transition-colors',
                active
                  ? 'font-semibold text-ink after:bg-signal'
                  : 'text-ink-2 after:bg-transparent hover:text-ink',
                itemClassName
              )}
            >
              {label}
              <NavPendingDot />
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

export default NavItems;
