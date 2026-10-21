"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { removeFromWatchlist } from "@/lib/actions/watchlist.actions";
import { notify } from "@/lib/notify";
import clsx from "clsx";
import { BellPlus, Loader2, Star } from "lucide-react";
import Link from "next/link";
import { EmptyState as SignalistEmptyState } from "@/components/ui/empty-state";

type WatchlistEntry = {
	_id?: string;
	symbol: string;
	company: string;
	addedAt?: string | Date;
	price?: number;
	changePercent?: number;
	marketCap?: number;
	volume?: number;
	isCrypto?: boolean;
	dayHigh?: number;
	dayLow?: number;
	aiScore?: number;
};

type WatchlistTableProps = {
	items: WatchlistEntry[];
	onAddAlert?: (entry: WatchlistEntry) => void;
};

const formatDate = (value?: string | Date) => {
	if (!value) return "-";
	const d = typeof value === "string" ? new Date(value) : value;
	if (Number.isNaN(d.getTime())) return "-";
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const EmptyState = () => (
	<SignalistEmptyState
		title="No symbols yet"
		description="Search for a ticker above and add it. Price, daily move and AI score appear here, and you can set an alert from each row."
	/>
);

const formatNumber = (value?: number, opts: Intl.NumberFormatOptions = {}) => {
	if (value === undefined || value === null || Number.isNaN(value)) return '-';
	return new Intl.NumberFormat(undefined, opts).format(value);
};

const formatCurrency = (value?: number) => formatNumber(value, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const formatPrice = (value?: number) => {
	if (value === undefined || value === null || Number.isNaN(value)) return '-';
	return formatCurrency(value);
};

const WatchlistTable = ({ items, onAddAlert }: WatchlistTableProps) => {
	const [rows, setRows] = useState<WatchlistEntry[]>(items);
	const [pendingSymbol, setPendingSymbol] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		setRows(items);
	}, [items]);

	const handleRemove = (symbol: string) => {
		setPendingSymbol(symbol);
		startTransition(async () => {
			const res = await removeFromWatchlist(symbol);
			if (!res.success) {
				notify.watchlistFailed("remove", res.message);
				setPendingSymbol(null);
				return;
			}
			setRows((prev) => prev.filter((row) => row.symbol !== symbol));
			setPendingSymbol(null);
			notify.watchlistRemoved(symbol);
		});
	};

	const content = useMemo(() => {
		if (!rows.length) return <EmptyState />;

		return (
			<div className="surface-card overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow className="border-b border-line">
							<TableHead className="w-12"><span className="sr-only">Remove</span></TableHead>
							<TableHead>Symbol</TableHead>
							<TableHead className="text-right">Price</TableHead>
							<TableHead className="text-right">Today</TableHead>
							<TableHead className="hidden text-right md:table-cell">Day range</TableHead>
							<TableHead className="hidden text-right sm:table-cell">AI score</TableHead>
							<TableHead className="hidden w-28 text-right sm:table-cell"><span className="sr-only">Alert</span></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => {
							const busy = isPending && pendingSymbol === row.symbol;
							const ch = row.changePercent;
							return (
								<TableRow key={row.symbol} className="group hover:bg-surface-2">
									<TableCell className="w-10 py-3 pl-2 pr-0 sm:pl-3">
										<button
											onClick={() => handleRemove(row.symbol)}
											disabled={busy}
											aria-busy={busy}
											aria-label={`Remove ${row.symbol} from watchlist`}
											className="press inline-flex size-8 items-center justify-center rounded-md text-signal hover:bg-surface-3 disabled:opacity-60"
											title="Remove from watchlist"
										>
											{busy ? <Loader2 className="size-4 animate-spin" /> : <Star className="size-4 fill-current" />}
										</button>
									</TableCell>
									<TableCell className="py-3">
										<Link href={`/stocks/${row.symbol}`} className="block min-w-0">
											<span className="mono block text-[14px] font-medium text-ink">{row.symbol}</span>
											<span className="block max-w-[120px] truncate text-[13px] text-ink-3 sm:max-w-[220px]">{row.company}</span>
										</Link>
									</TableCell>
									<TableCell className="mono py-3 text-right text-[14px] text-ink">{formatCurrency(row.price)}</TableCell>
									<TableCell
										className={clsx(
											'mono py-3 text-right text-[14px]',
											typeof ch === 'number' ? (ch >= 0 ? 'text-up' : 'text-down') : 'text-ink-3'
										)}
									>
										{typeof ch === 'number' ? `${ch >= 0 ? '+' : '−'}${Math.abs(ch).toFixed(2)}%` : '—'}
									</TableCell>
									<TableCell className="mono hidden py-3 text-right text-[13px] text-ink-2 md:table-cell">
										{row.dayLow != null && row.dayHigh != null
											? `${formatPrice(row.dayLow)} – ${formatPrice(row.dayHigh)}`
											: '—'}
									</TableCell>
									<TableCell className="mono hidden py-3 text-right text-[14px] sm:table-cell">
										{row.aiScore != null ? (
											<span className={row.aiScore >= 65 ? 'text-up' : row.aiScore >= 45 ? 'text-ink' : 'text-down'}>
												{Math.round(row.aiScore)}
											</span>
										) : (
											<span className="text-ink-3">—</span>
										)}
									</TableCell>
									<TableCell className="hidden py-3 pr-3 text-right sm:table-cell">
										<Button variant="outline" size="sm" aria-label={`New alert for ${row.symbol}`} className="px-2.5" onClick={() => onAddAlert?.(row)}>
											<BellPlus className="size-3.5" />
											<span className="hidden sm:inline">Alert</span>
										</Button>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>
		);
	}, [rows, isPending, pendingSymbol]);

	return content;
};

export default WatchlistTable;
