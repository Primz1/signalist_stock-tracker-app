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
import NavItems from './NavItems';

const UserDropdown = ({ user }: { user: User }) => {
  const router = useRouter();
  const initials = userInitials(user.name);

  const handleSignOut = async () => {
    await signOut();
    router.push('/sign-in');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(253,212,88,0.12)] font-mono text-[12px] font-semibold text-[#F5F5F5] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FDD458]"
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[200px] overflow-hidden rounded-xl border border-[#2E2E2E] bg-[#141414] text-[#A1A1A1] shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
      >
        <DropdownMenuLabel className="border-b border-[#242424] px-3.5 py-3">
          <div className="text-[13px] font-medium text-[#F5F5F5]">{user.name}</div>
          <div className="text-[12px] text-[#6E6E6E]">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuItem asChild className="cursor-pointer px-3.5 py-2 text-[13px] focus:bg-transparent focus:text-[#FDD458]">
          <Link href="/settings">Settings</Link>
        </DropdownMenuItem>
        <div className="flex cursor-default justify-between px-3.5 py-2 text-[13px] text-[#6E6E6E]">
          Theme <span className="text-[11px]">Dark</span>
        </div>
        <DropdownMenuSeparator className="bg-[#242424]" />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer px-3.5 py-2 text-[13px] text-[#A1A1A1] focus:bg-transparent focus:text-[#FDD458]"
        >
          Sign out
        </DropdownMenuItem>
        <div className="border-t border-[#242424] p-2 sm:hidden">
          <NavItems className="flex-col items-stretch gap-1" itemClassName="h-auto border-0 py-2" />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserDropdown;
