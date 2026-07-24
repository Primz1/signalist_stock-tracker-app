"use client";
import React, { useMemo, useState, useTransition } from "react";
import { addToWatchlist, removeFromWatchlist } from "@/lib/actions/watchlist.actions";
import { notify } from "@/lib/notify";
import { trackEvent } from "@/components/providers/PostHogProvider";
import { Loader2 } from "lucide-react";

const WatchlistButton = ({
  symbol,
  company,
  isInWatchlist,
  showTrashIcon = false,
  type = "button",
  variant = "filled",
  onWatchlistChange,
}: WatchlistButtonProps) => {
  const [added, setAdded] = useState<boolean>(!!isInWatchlist);
  const [isPending, startTransition] = useTransition();

  const label = useMemo(() => {
    if (type === "icon") return "";
    return added ? "Remove from watchlist" : "Add to watchlist";
  }, [added, type]);

  const handleClick = () => {
    startTransition(async () => {
      const sym = symbol.toUpperCase();
      if (added) {
        const res = await removeFromWatchlist(sym);
        if (!res.success) {
          notify.watchlistFailed("remove", res.message);
          return;
        }
        setAdded(false);
        onWatchlistChange?.(sym, false);
        trackEvent("watchlist_removed", { symbol: sym });
        notify.watchlistRemoved(sym);
      } else {
        const res = await addToWatchlist(sym, company);
        if (!res.success) {
          notify.watchlistFailed("add", res.message);
          return;
        }
        setAdded(true);
        onWatchlistChange?.(sym, true);
        trackEvent("watchlist_added", { symbol: sym });
        notify.watchlistAdded(sym);
      }
    });
  };

  if (type === "icon") {
    return (
      <button
        title={added ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
        aria-label={added ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
        aria-busy={isPending}
        className={`watchlist-icon-btn ${added ? "watchlist-icon-added" : ""}`}
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="watchlist-star animate-spin text-[#FACC15]" />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={added ? "#FACC15" : "none"}
            stroke="#FACC15"
            strokeWidth="1.5"
            className="watchlist-star"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.385a.563.563 0 00-.182-.557L3.04 10.385a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z"
            />
          </svg>
        )}
      </button>
    );
  }

  const outlineClass = added
    ? "inline-flex h-9 w-auto items-center gap-1.5 rounded-lg border border-[#EF4444] bg-transparent px-3.5 text-[13px] font-medium text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)]"
    : "inline-flex h-9 w-auto items-center gap-1.5 rounded-lg border border-[#FDD458] bg-transparent px-3.5 text-[13px] font-medium text-[#FDD458] hover:bg-[rgba(253,212,88,0.08)]";

  return (
    <button
      className={
        variant === "outline"
          ? outlineClass
          : `watchlist-btn ${added ? "watchlist-remove" : ""}`
      }
      onClick={handleClick}
      disabled={isPending}
      aria-busy={isPending}
    >
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (showTrashIcon || variant === "outline") && added ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="size-3.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 6h18M8 6V4.5A1.5 1.5 0 019.5 3h5A1.5 1.5 0 0116 4.5V6m-1 0v12a2 2 0 01-2 2H9a2 2 0 01-2-2V6m3 5v6m4-6v6"
          />
        </svg>
      ) : null}
      <span>{isPending ? "Working..." : label}</span>
    </button>
  );
};

export default WatchlistButton;
