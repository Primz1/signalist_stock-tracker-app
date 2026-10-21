import Link from 'next/link';
import { cn } from '@/lib/utils';

/** The mark: two candles and the alert level they cross. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn('size-6 flex-none', className)}>
      <rect width="24" height="24" rx="6" fill="var(--sg-signal)" />
      <g fill="var(--sg-signal-ink)" stroke="var(--sg-signal-ink)" strokeLinecap="round">
        <line x1="8.5" y1="5" x2="8.5" y2="18.5" strokeWidth="1.4" />
        <rect x="6.5" y="9" width="4" height="7" rx="0.8" stroke="none" />
        <line x1="15.5" y1="4.5" x2="15.5" y2="15" strokeWidth="1.4" />
        <rect x="13.5" y="6.5" width="4" height="5" rx="0.8" stroke="none" />
      </g>
      <line x1="3" y1="13.25" x2="21" y2="13.25" stroke="var(--sg-signal-ink)" strokeWidth="1" strokeDasharray="1.6 1.4" opacity="0.7" />
    </svg>
  );
}

export default function BrandLogo({
  showWordmark = true,
  className,
  href = '/dashboard',
}: {
  showWordmark?: boolean;
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="Signalist home"
      className={cn('flex flex-none items-center gap-2 rounded-md', className)}
    >
      <BrandMark />
      {showWordmark && (
        <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">Signalist</span>
      )}
    </Link>
  );
}

export function userInitials(name?: string | null) {
  if (!name?.trim()) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
