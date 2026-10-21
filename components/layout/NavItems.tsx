'use client';

import { NAV_ITEMS } from '@/lib/constants';
import Link from 'next/link';
import { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

function NavPendingDot() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      className="ml-1.5 inline-block size-1.5 animate-pulse-soft rounded-full bg-signal"
      aria-hidden
    />
  );
}

const NavItems = ({
  className,
  itemClassName,
}: {
  className?: string;
  itemClassName?: string;
}) => {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <ul className={cn('flex h-14 items-center gap-1', className)}>
      {NAV_ITEMS.map(({ href, label }) => {
        const active = isActive(href);
        return (
          <li key={href} className="relative flex h-full items-center">
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex h-8 items-center whitespace-nowrap rounded-md px-3 text-[14px] transition-colors duration-150',
                active
                  ? 'font-medium text-ink'
                  : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                itemClassName
              )}
            >
              {label}
              <NavPendingDot />
            </Link>
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-signal"
              />
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default NavItems;
