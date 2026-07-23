import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function BrandLogo({
  showWordmark = true,
  className,
}: {
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <Link href="/" className={cn('flex items-center gap-2 flex-none', className)}>
      <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-[#FDD458] text-[14px] font-bold text-[#0A0A0A]">
        S
      </div>
      {showWordmark && (
        <span className="text-[14px] font-semibold tracking-[-0.01em] text-[#F5F5F5]">
          Signalist
        </span>
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
