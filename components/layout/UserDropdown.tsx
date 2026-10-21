'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/actions/auth.actions';
import Link from 'next/link';
import { userInitials } from './BrandLogo';

const UserDropdown = ({ user }: { user: User }) => {
  const router = useRouter();
  const initials = userInitials(user.name);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account"
          className="press flex size-8 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-[12px] font-semibold text-ink hover:border-ink-3"
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[240px] overflow-hidden p-1 text-ink-2"
      >
        <DropdownMenuLabel className="px-3 py-2.5">
          <div className="text-[14px] font-medium text-ink">{user.name}</div>
          <div className="truncate text-[12px] font-normal text-ink-3">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-line" />
        <DropdownMenuItem asChild className="cursor-pointer rounded-md px-3 py-2 text-[14px] text-ink-2 focus:bg-surface-2 focus:text-ink">
          <Link href="/settings">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer rounded-md px-3 py-2 text-[14px] text-ink-2 focus:bg-surface-2 focus:text-ink">
          <Link href="/developers">API keys</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer rounded-md px-3 py-2 text-[14px] text-ink-2 focus:bg-surface-2 focus:text-ink">
          <Link href="/portfolio/history">Trade history</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-line" />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer rounded-md px-3 py-2 text-[14px] text-ink-2 focus:bg-surface-2 focus:text-ink"
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserDropdown;
