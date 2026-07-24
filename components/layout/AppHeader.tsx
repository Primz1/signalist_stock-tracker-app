'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import BrandLogo from '@/components/layout/BrandLogo';
import NavItems from '@/components/layout/NavItems';
import UserDropdown from '@/components/layout/UserDropdown';
import { SearchCommand } from '@/components/search/SearchCommand';
import { markNotifications } from '@/lib/actions/alertNotification.actions';

type Notification = {
  _id?: string;
  symbol: string;
  message: string;
  triggeredAt: string;
  read: boolean;
};

export default function AppHeader({
  user,
  initialStocks,
  watchlistSymbols,
  initialNotifications = [],
}: {
  user: User;
  initialStocks: StockWithWatchlistStatus[];
  watchlistSymbols?: string[];
  initialNotifications?: Notification[];
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);

  const unread = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    await markNotifications();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <header className="sticky top-0 z-20 border-b border-[#242424] bg-[#141414]">
      <div className="relative mx-auto flex h-14 max-w-[1400px] items-center px-4 md:px-6 lg:px-8">
        {/* Left — brand */}
        <div className="relative z-10 flex flex-none items-center">
          <BrandLogo />
        </div>

        {/* Center — nav links + search (true center on desktop) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-14 items-center justify-center md:flex">
          <div className="pointer-events-auto flex items-center gap-5 lg:gap-6">
            <NavItems className="h-14 gap-5 lg:gap-6" />
            <SearchCommand
              renderAs="button"
              label="Search stocks..."
              initialStocks={initialStocks}
              watchlistSymbols={watchlistSymbols}
              quickAddEnabled
              className="!max-w-[240px] lg:!max-w-[280px]"
            />
          </div>
        </div>

        {/* Right — mobile search + alerts + account */}
        <div className="relative z-10 ml-auto flex flex-none items-center gap-2 md:gap-3.5">
          <div className="md:hidden">
            <SearchCommand
              renderAs="icon"
              label="Search"
              initialStocks={initialStocks}
              watchlistSymbols={watchlistSymbols}
              quickAddEnabled
            />
          </div>

          <button
            type="button"
            aria-label="Notifications"
            onClick={() => setNotifOpen((o) => !o)}
            className="relative flex p-1.5 text-[#A1A1A1] transition-colors hover:text-[#FDD458]"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.5} />
            {unread > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#FDD458] text-[9px] font-bold text-[#0A0A0A]">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <button
                type="button"
                aria-label="Close notifications"
                className="fixed inset-0 z-20 cursor-default"
                onClick={() => setNotifOpen(false)}
              />
              <div className="animate-toast absolute right-9 top-10 z-30 w-80 overflow-hidden rounded-xl border border-[#2E2E2E] bg-[#141414] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                <div className="flex items-center justify-between border-b border-[#242424] px-3.5 py-3">
                  <div className="text-[13px] font-semibold text-[#F5F5F5]">Alerts</div>
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-[12px] text-[#A1A1A1] hover:text-[#FDD458]"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-72 overflow-auto">
                  {notifications.length === 0 ? (
                    <div className="px-3.5 py-6 text-center text-[13px] text-[#6E6E6E]">
                      No alerts yet.
                    </div>
                  ) : (
                    notifications.slice(0, 8).map((n) => (
                      <div
                        key={n._id || `${n.symbol}-${n.triggeredAt}`}
                        className={`border-b border-[#242424] px-3.5 py-2.5 last:border-0 ${
                          !n.read ? 'border-l-2 border-l-[#FDD458] bg-[rgba(253,212,88,0.04)]' : ''
                        }`}
                      >
                        <div className="text-[13px] text-[#F5F5F5]">
                          {n.symbol}: {n.message}
                        </div>
                        <div className="mt-0.5 text-[12px] text-[#6E6E6E]">
                          {new Date(n.triggeredAt).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <Link
                  href="/watchlist"
                  onClick={() => setNotifOpen(false)}
                  className="block border-t border-[#242424] px-3.5 py-2.5 text-center text-[12px] text-[#FDD458]"
                >
                  View watchlist
                </Link>
              </div>
            </>
          )}

          <UserDropdown user={user} />
        </div>
      </div>
    </header>
  );
}
