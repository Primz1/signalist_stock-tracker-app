"use client";
import React, { useMemo, useState, useTransition } from "react";
import { addToWatchlist, removeFromWatchlist } from "@/lib/actions/watchlist.actions";
import { toast } from "sonner";
import { trackEvent } from "@/components/providers/PostHogProvider";
import { Loader2 } from "lucide-react";

const WatchlistButton = ({
  symbol,
  company,
  isInWatchlist,
  showTrashIcon = false,
  type = "button",
  onWatchlistChange,
}: WatchlistButtonProps) => {
  const [added, setAdded] = useState<boolean>(!!isInWatchlist);
  const [isPending, startTransition] = useTransition();

  const label = useMemo(() => {
    if (type === "icon") return "";
    return added ? "Remove from Watchlist" : "Add to Watchlist";
  }, [added, type]);

  const handleClick = () => {
    startTransition(async () => {
      const sym = symbol.toUpperCase();
      if (added) {
        const res = await removeFromWatchlist(sym);
        if (!res.success) {
          toast.error(res.message || "Failed to remove");
          return;
        }
        setAdded(false);
        onWatchlistChange?.(sym, false);
        trackEvent("watchlist_removed", { symbol: sym });
        toast.success(`${sym} removed from watchlist`);
      } else {
        const res = await addToWatchlist(sym, company);
        if (!res.success) {
          toast.error(res.message || "Failed to add");
          return;
        }
        setAdded(true);
        onWatchlistChange?.(sym, true);
        trackEvent("watchlist_added", { symbol: sym });
        toast.success(`${sym} added to watchlist`);
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

  return (
    <button
      className={`watchlist-btn ${added ? "watchlist-remove" : ""}`}
      onClick={handleClick}
      disabled={isPending}
      aria-busy={isPending}
    >
      {isPending ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : showTrashIcon && added ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-5 h-5 mr-2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 4v6m4-6v6m4-6v6" />
        </svg>
      ) : null}
      <span>{isPending ? "Working..." : label}</span>
    </button>
  );
};

export default WatchlistButton;
