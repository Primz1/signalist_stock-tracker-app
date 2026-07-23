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
      className="ml-1.5 inline-block size-1.5 animate-pulse rounded-full bg-[#FDD458]"
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
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <ul className={cn('flex h-14 items-center gap-1 lg:gap-5', className)}>
      {NAV_ITEMS.map(({ href, label }) => (
        <li key={href} className="flex h-14 items-center">
          <Link
            href={href}
            className={cn(
              'inline-flex h-14 items-center whitespace-nowrap px-1.5 text-[13px] transition-colors hover:text-[#FDD458] lg:px-0',
              isActive(href)
                ? 'border-b-2 border-[#FDD458] font-medium text-[#F5F5F5]'
                : 'border-b-2 border-transparent text-[#A1A1A1]',
              itemClassName
            )}
          >
            {label}
            <NavPendingDot />
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default NavItems;
