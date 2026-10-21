"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SearchCommand } from "@/components/search/SearchCommand";
import WatchlistTable from "@/components/watchlist/WatchlistTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addToWatchlist } from "@/lib/actions/watchlist.actions";
import { createAlert, deleteAlert, setAlertActive, runAlertSweepAction } from "@/lib/actions/alert.actions";
import { getNotifications, markNotifications } from "@/lib/actions/alertNotification.actions";
import { ArrowUpRight, Bell, BellPlus, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { notify } from "@/lib/notify";
import { EmptyState } from "@/components/ui/empty-state";
import { PageEnter } from "@/components/ui/motion";
import { NewsCard } from "@/components/ui/news-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type WatchlistEntry = {
  _id?: string;
  symbol: string;
  company: string;
  addedAt?: string | Date;
  price?: number;
  changePercent?: number;
  marketCap?: number;
  peRatio?: number;
  volume?: number;
  isCrypto?: boolean;
  dayHigh?: number;
  dayLow?: number;
  aiScore?: number;
};

export type AlertEntry = {
  _id?: string;
  symbol: string;
  company: string;
  alertName: string;
  alertType: "price";
  condition: "gt" | "lt";
  threshold: number;
  frequency: "once" | "per_hour" | "per_day";
  isActive?: boolean;
  createdAt?: string;
  lastTriggeredAt?: string;
  lastNotifiedAt?: string;
  lastPrice?: number;
  lastChangePercent?: number;
};

type AlertNotificationEntry = {
  _id?: string;
  alertId: string;
  symbol: string;
  company: string;
  message: string;
  price?: number;
  changePercent?: number;
  triggeredAt: string;
  read: boolean;
};

const NewsGrid = ({ articles }: { articles: MarketNewsArticle[] }) => {
  if (!articles?.length) {
    return (
      <div className="rounded-lg border border-line bg-surface p-4 text-sm text-ink-2">
        No news available right now.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <NewsCard
        title="Market news"
        items={articles.slice(0, 6).map((article) => ({
          time: article.datetimeString || '',
          headline: article.headline,
          source: article.source || 'News',
          href: article.url || undefined,
        }))}
      />
      <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="section-title">All headlines</h2>
        <span className="text-[13px] text-ink-3">Latest first</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <Link
            key={`${article.id}-${article.url}`}
            href={article.url || "#"}
            target="_blank"
            className="group block rounded-lg border border-line bg-surface p-4 transition-colors duration-150 hover:border-line-strong hover:bg-surface-2"
          >
            <div className="flex items-center justify-between text-xs text-ink-3">
              <span>{article.source}</span>
              <span>{article.datetimeString}</span>
            </div>
            <div className="mt-2 text-[15px] font-medium leading-snug text-ink">
              {article.headline}
            </div>
            <div className="mt-1.5 line-clamp-3 text-[13px] leading-5 text-ink-2">{article.summary}</div>
            <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-ink-3 group-hover:text-signal">
              Read more <ArrowUpRight className="h-3 w-3" />
            </div>
          </Link>
        ))}
      </div>
      </div>
    </div>
  );
};

const AlertsPlaceholder = () => (
  <div className="h-full rounded-lg border border-line bg-surface p-4 text-ink">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold">Alerts</h2>
      <Button size="sm" variant="secondary" className="yellow-btn">
        Create Alert
      </Button>
    </div>
    <p className="text-sm text-ink-2">Alert management UI coming soon.</p>
  </div>
);

interface WatchlistClientProps {
  initialItems: WatchlistEntry[];
  initialStocks: StockWithWatchlistStatus[];
  initialSymbols: string[];
  initialAlerts: AlertEntry[];
  initialNotifications: AlertNotificationEntry[];
  initialNews: MarketNewsArticle[];
}

const WatchlistClient = ({ initialItems, initialStocks, initialSymbols, initialAlerts, initialNotifications, initialNews }: WatchlistClientProps) => {
  const [rows, setRows] = useState<WatchlistEntry[]>(initialItems);
  const [symbols, setSymbols] = useState<string[]>(initialSymbols);
  const [alerts, setAlerts] = useState<AlertEntry[]>(initialAlerts ?? []);
  const [notifications, setNotifications] = useState<AlertNotificationEntry[]>(initialNotifications ?? []);
  const notificationsRef = useRef<AlertNotificationEntry[]>(initialNotifications ?? []);
  const [isPending] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const [alertModalOpen, setAlertModalOpen] = useState(false);

  const token = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
  const isCryptoSymbol = (sym: string) => /USDT$|USDC$|USD$|BTC$|ETH$|BNB$/i.test(sym);
  const buildQuoteUrl = (sym: string) => {
    const upper = sym.toUpperCase();
    return `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(upper)}&token=${token}`;
  };

  const [alertName, setAlertName] = useState("");
  const [alertSymbol, setAlertSymbol] = useState<string>(initialSymbols[0] ?? "");
  const [alertCondition, setAlertCondition] = useState<"gt" | "lt">("lt");
  const [alertThreshold, setAlertThreshold] = useState<string>("");
  const [alertFrequency, setAlertFrequency] = useState<"once" | "per_hour" | "per_day">("once");
  const [isCreatingAlert, startCreatingAlert] = useTransition();

  const fetchBinanceTicker = async (sym: string) => {
    const upper = sym.toUpperCase();
    const endpoints = [
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(upper)}`,
      `https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${encodeURIComponent(upper)}`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        const data = await res.json();
        const price = data?.lastPrice ? Number(data.lastPrice) : undefined;
        const changePercent = data?.priceChangePercent ? Number(data.priceChangePercent) : undefined;
        const volume = data?.quoteVolume ? Number(data.quoteVolume) : data?.volume ? Number(data.volume) : undefined;
        const dayHigh = data?.highPrice ? Number(data.highPrice) : undefined;
        const dayLow = data?.lowPrice ? Number(data.lowPrice) : undefined;
        if (price !== undefined || changePercent !== undefined || volume !== undefined || dayHigh !== undefined || dayLow !== undefined) {
          return { price, changePercent, volume, dayHigh, dayLow } as const;
        }
      } catch {
        continue;
      }
    }

    return null;
  };

  const refreshQuotes = async (targetSymbols?: string[]) => {
    const list = (targetSymbols ?? symbols).map((s) => s.toUpperCase());
    if (!list.length) return;

    setRefreshing(true);
    try {
      const results = await Promise.all(
        list.map(async (sym) => {
          if (isCryptoSymbol(sym)) {
            const data = await fetchBinanceTicker(sym);
            return { sym, data } as const;
          }

          if (!token) return { sym, data: null } as const;

          try {
            const res = await fetch(buildQuoteUrl(sym), { cache: 'no-store' });
            if (!res.ok) return { sym, data: null } as const;
            const data = await res.json();
            return { sym, data } as const;
          } catch {
            return { sym, data: null } as const;
          }
        })
      );

      setRows((prev) =>
        prev.map((row) => {
          const symUpper = row.symbol.toUpperCase();
          const hit = results.find((r) => r.sym === symUpper);
          if (!hit?.data) return row;
          const price = typeof hit.data.c === 'number' ? hit.data.c : typeof hit.data.price === 'number' ? hit.data.price : row.price;
          const changePercent = typeof hit.data.dp === 'number' ? hit.data.dp : typeof hit.data.changePercent === 'number' ? hit.data.changePercent : row.changePercent;
          const volume = typeof hit.data.v === 'number' ? hit.data.v : typeof hit.data.volume === 'number' ? hit.data.volume : row.volume;
          const dayHigh = typeof hit.data.h === 'number' ? hit.data.h : typeof hit.data.dayHigh === 'number' ? hit.data.dayHigh : row.dayHigh;
          const dayLow = typeof hit.data.l === 'number' ? hit.data.l : typeof hit.data.dayLow === 'number' ? hit.data.dayLow : row.dayLow;
          return { ...row, price, changePercent, volume, dayHigh, dayLow };
        })
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleAdd = async (stock: StockWithWatchlistStatus) => {
    setRefreshing(true);
    const res = await addToWatchlist(stock.symbol, stock.name);
    if (!res.success) {
      notify.watchlistFailed("add", res.message);
      setRefreshing(false);
      return;
    }

    setRows((prev) => {
      if (prev.some((row) => row.symbol === stock.symbol)) return prev;
      const symUpper = stock.symbol.toUpperCase();
      return [{ symbol: symUpper, company: stock.name, addedAt: new Date().toISOString(), isCrypto: isCryptoSymbol(symUpper) }, ...prev];
    });
    setSymbols((prev) => {
      const symUpper = stock.symbol.toUpperCase();
      return prev.includes(symUpper) ? prev : [...prev, symUpper];
    });
    notify.watchlistAdded(stock.symbol);

    // Grab fresh quote immediately for the added symbol
    await refreshQuotes([stock.symbol]);
    setRefreshing(false);
  };

  useEffect(() => {
    // SSR already provided prices — poll later, don't storm quotes on mount
    const interval = setInterval(() => refreshQuotes(), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join('|')]);

  useEffect(() => {
    if (!alertSymbol && symbols.length) {
      setAlertSymbol(symbols[0]);
    }
  }, [alertSymbol, symbols]);

  const priceLookup = useMemo(() => {
    const map = new Map<string, { price?: number; changePercent?: number }>();
    rows.forEach((row) => map.set(row.symbol.toUpperCase(), { price: row.price, changePercent: row.changePercent }));
    return map;
  }, [rows]);

  const resolveCompany = (sym: string) => {
    const hit = rows.find((row) => row.symbol.toUpperCase() === sym.toUpperCase());
    return hit?.company || sym;
  };

  const resetAlertForm = () => {
    setAlertName("");
    setAlertThreshold("");
    setAlertCondition("lt");
    setAlertFrequency("once");
  };

  const openAlertFor = (entry: WatchlistEntry) => {
    setAlertSymbol(entry.symbol.toUpperCase());
    setAlertName(`${entry.symbol.toUpperCase()} alert`);
    setAlertThreshold(entry.price ? String(entry.price) : "");
    setAlertModalOpen(true);
  };

  const handleCreateAlert = () => {
    const thresholdValue = Number(alertThreshold);
    if (!Number.isFinite(thresholdValue)) {
      notify.warning("Invalid threshold", "Enter a numeric price level.");
      return;
    }
    if (!alertSymbol) {
      notify.warning("Pick a symbol", "Select a symbol before creating an alert.");
      return;
    }

    startCreatingAlert(async () => {
      const res = await createAlert({
        symbol: alertSymbol,
        company: resolveCompany(alertSymbol),
        alertName: alertName.trim() || `${alertSymbol} alert`,
        alertType: "price",
        condition: alertCondition,
        threshold: thresholdValue,
        frequency: alertFrequency,
      });
      if (!res.success) {
        notify.alertFailed(res.message);
        return;
      }

      const newAlert: AlertEntry = {
        _id: (res.data as any)._id ? String((res.data as any)._id) : (res.data as any).id,
        symbol: res.data.symbol.toUpperCase(),
        company: res.data.company,
        alertName: res.data.alertName,
        alertType: res.data.alertType ?? "price",
        condition: res.data.condition,
        threshold: res.data.threshold,
        frequency: res.data.frequency,
        isActive: res.data.isActive,
        createdAt: (res.data as any).createdAt ?? new Date().toISOString(),
      };

      setAlerts((prev) => [newAlert, ...prev]);
      setAlertModalOpen(false);
      resetAlertForm();
      notify.alertCreated(alertSymbol);
      runAlertSweepAction();
    });
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (!alertId) return;
    setRefreshing(true);
    try {
      const res = await deleteAlert(alertId);
      if (!res.success) {
        notify.alertFailed(res.message);
        return;
      }
      setAlerts((prev) => prev.filter((a) => a._id !== alertId));
      notify.alertRemoved();
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleAlert = async (alertId: string, isActive: boolean) => {
    const res = await setAlertActive(alertId, isActive);
    if (!res.success) {
      notify.alertFailed(res.message);
      return;
    }
    setAlerts((prev) => prev.map((a) => (a._id === alertId ? { ...a, isActive } : a)));
    notify.alertUpdated(isActive);
  };

  const frequencyLabel = (freq: "once" | "per_hour" | "per_day") => {
    if (freq === "per_hour") return "Once per hour";
    if (freq === "per_day") return "Once per day";
    return "Once";
  };

  const formatPriceDisplay = (value?: number) => {
    if (value === undefined || value === null || Number.isNaN(value)) return "-";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
  };

  const timeAgo = (iso?: string) => {
    if (!iso) return null;
    const date = new Date(iso);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await getNotifications();
        if (!('success' in res) || !res.success) return;

        const existingIds = new Set(notificationsRef.current.map((n) => n._id || `${n.alertId}-${n.triggeredAt}`));
        const mapped = (res.data || []).map((n: any) => ({
          _id: typeof n._id === 'object' && 'toString' in n._id ? (n._id as any).toString() : (n._id as any) ?? undefined,
          alertId: typeof n.alertId === 'object' && 'toString' in n.alertId ? (n.alertId as any).toString() : String(n.alertId ?? ''),
          symbol: (n.symbol || '').toUpperCase(),
          company: n.company,
          message: n.message,
          price: n.price,
          changePercent: n.changePercent,
          triggeredAt: n.triggeredAt ? new Date(n.triggeredAt).toISOString() : new Date().toISOString(),
          read: Boolean(n.read),
        })) as AlertNotificationEntry[];

        const newOnes = mapped.filter((n) => !existingIds.has(n._id || `${n.alertId}-${n.triggeredAt}`));
        if (newOnes.length > 0) {
          newOnes.forEach((n) =>
            notify.info(`${n.symbol} alert`, n.message)
          );
        }
        notificationsRef.current = mapped;
        setNotifications(mapped);
      } catch (err) {
        // silent
      }
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const runSweep = async () => {
      try {
        await runAlertSweepAction();
      } catch {
        // silent
      }
    };

    runSweep();
    const interval = setInterval(runSweep, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkNotifications = async () => {
    const res = await markNotifications();
    if (!res.success) {
      notify.error("Couldn’t mark notifications", res.message);
      return;
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const activeAlerts = alerts.filter((a) => a.isActive).length;

  return (
    <PageEnter>
      <section className="space-y-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="page-title">Watchlist</h1>
          <p className="page-lede">
            {rows.length} {rows.length === 1 ? 'symbol' : 'symbols'} · {activeAlerts} active{' '}
            {activeAlerts === 1 ? 'alert' : 'alerts'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[min(100%,260px)]">
            <SearchCommand
              renderAs="button"
              label={refreshing || isPending ? "Adding…" : "Add symbol"}
              initialStocks={initialStocks}
              watchlistSymbols={symbols}
              onSelectStock={handleAdd}
              mode="add"
            />
          </div>
          <Button onClick={() => setAlertModalOpen(true)}>
            <BellPlus className="size-4" />
            New alert
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="news">News</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-0">
      <div className="relative grid items-start gap-8 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        {refreshing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-canvas/60">
            <Loader2 className="size-6 animate-spin text-signal" />
          </div>
        )}
        <WatchlistTable items={rows} onAddAlert={openAlertFor} />

        <div className="space-y-8">
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="section-title">Alerts</h2>
              <span className="text-[13px] text-ink-3">{alerts.length} set</span>
            </div>
            {alerts.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No alerts yet"
                description="Pick a symbol, choose above or below a price, and Signalist checks it in the background."
                actionLabel="New alert"
                onAction={() => setAlertModalOpen(true)}
              />
            ) : (
              <ul className="surface-card max-h-[560px] divide-y divide-line overflow-y-auto">
                {alerts.map((alert) => {
                  const quote = priceLookup.get(alert.symbol.toUpperCase());
                  const price = quote?.price;
                  const away =
                    typeof price === 'number' && alert.threshold
                      ? ((alert.threshold - price) / price) * 100
                      : null;
                  return (
                    <li
                      key={alert._id || `${alert.symbol}-${alert.threshold}`}
                      className={`px-4 py-3.5 ${alert.isActive ? '' : 'opacity-60'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-baseline gap-2">
                          <span className="mono text-[14px] font-medium text-ink">{alert.symbol}</span>
                          <span className="truncate text-[14px] text-ink-2">
                            {alert.condition === 'gt' ? 'above' : 'below'}{' '}
                            <span className="mono text-ink">{formatPriceDisplay(alert.threshold)}</span>
                          </span>
                        </div>
                        <div className="flex flex-none items-center gap-1">
                          {alert._id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2.5 text-[13px]"
                              onClick={() => handleToggleAlert(alert._id!, !alert.isActive)}
                            >
                              {alert.isActive ? "Pause" : "Resume"}
                            </Button>
                          )}
                          {alert._id && (
                            <button
                              onClick={() => handleDeleteAlert(alert._id!)}
                              className="press flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-down"
                              aria-label={`Delete ${alert.symbol} alert`}
                              title="Delete alert"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[13px] text-ink-3">
                        <span className="mono text-ink-2">{formatPriceDisplay(price)}</span>
                        {away != null && (
                          <span className="mono">{Math.abs(away).toFixed(1)}% away</span>
                        )}
                        <span>{frequencyLabel(alert.frequency)}</span>
                        <span className={alert.lastTriggeredAt ? 'text-signal' : ''}>
                          {alert.lastTriggeredAt
                            ? `Fired ${timeAgo(alert.lastTriggeredAt)}`
                            : alert.isActive
                              ? 'Waiting'
                              : 'Paused'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="section-title">
                Fired{unreadCount > 0 && <span className="mono ml-2 text-[13px] font-medium text-signal">{unreadCount} new</span>}
              </h2>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkNotifications}
                  className="text-[13px] text-ink-2 hover:text-ink"
                >
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="Nothing has fired yet"
                description="When a price crosses one of your levels, it shows up here and in the bell at the top."
              />
            ) : (
              <ul className="surface-card max-h-[480px] divide-y divide-line overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n._id || `${n.alertId}-${n.triggeredAt}`} className="flex gap-3 px-4 py-3.5">
                    <span
                      aria-hidden
                      className={`mt-2 size-1.5 flex-none rounded-full ${n.read ? 'bg-transparent' : 'bg-signal'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="mono text-[14px] font-medium text-ink">{n.symbol}</span>
                        <span className="text-[12px] text-ink-3">{timeAgo(n.triggeredAt) || ''}</span>
                      </div>
                      <p className="mt-0.5 text-[14px] leading-5 text-ink-2">{n.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
        </TabsContent>
        <TabsContent value="news" className="mt-0">
          <NewsGrid articles={initialNews} />
        </TabsContent>
      </Tabs>

      <Dialog open={alertModalOpen} onOpenChange={setAlertModalOpen}>
        <DialogContent className="max-w-xl text-ink">
          <DialogHeader>
            <DialogTitle>New price alert</DialogTitle>
            <DialogDescription className="text-ink-2">
              Pick a symbol and a level. Signalist checks it in the background and tells you when price crosses.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="alertName">Name</Label>
              <Input
                id="alertName"
                placeholder="Apple at Discount"
                value={alertName}
                onChange={(e) => setAlertName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>Symbol</Label>
              <Select value={alertSymbol} onValueChange={setAlertSymbol}>
                <SelectTrigger className="w-full border-line-strong bg-surface text-ink">
                  <SelectValue placeholder="Select symbol" />
                </SelectTrigger>
                <SelectContent className="border-line bg-surface text-ink">
                  {symbols.map((sym) => (
                    <SelectItem key={sym} value={sym}>
                      {sym}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label>Condition</Label>
                <Select value={alertCondition} onValueChange={(v: "gt" | "lt") => setAlertCondition(v)}>
                  <SelectTrigger className="w-full border-line-strong bg-surface text-ink">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-line bg-surface text-ink">
                    <SelectItem value="gt">Greater than (&gt;)</SelectItem>
                    <SelectItem value="lt">Less than (&lt;)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Level</Label>
                <Input
                  type="number"
                  placeholder="e.g. 140.00"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Frequency</Label>
                <Select value={alertFrequency} onValueChange={(v: "once" | "per_hour" | "per_day") => setAlertFrequency(v)}>
                  <SelectTrigger className="w-full border-line-strong bg-surface text-ink">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-line bg-surface text-ink">
                    <SelectItem value="once">Once</SelectItem>
                    <SelectItem value="per_hour">Once per hour</SelectItem>
                    <SelectItem value="per_day">Once per day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              onClick={handleCreateAlert}
              disabled={isCreatingAlert}
              aria-busy={isCreatingAlert}
            >
              {isCreatingAlert ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create alert"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
    </PageEnter>
  );
};

export default WatchlistClient;
