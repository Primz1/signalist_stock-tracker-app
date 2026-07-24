"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { removeFromWatchlist } from "@/lib/actions/watchlist.actions";
import { notify } from "@/lib/notify";
import clsx from "clsx";
import { Loader2, Star } from "lucide-react";
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
		description="Use Add Stock to populate your watchlist."
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
			<div className="overflow-hidden rounded-xl border border-[#242424] bg-[#141414] shadow-md">
				<Table>
					<TableHeader className="bg-[#1C1C1C]/60">
						<TableRow>
							<TableHead></TableHead>
							<TableHead>Assets</TableHead>
							<TableHead>Symbol</TableHead>
							<TableHead>AI Score</TableHead>
							<TableHead>Price</TableHead>
							<TableHead>Change</TableHead>
							<TableHead>Day High</TableHead>
							<TableHead>Day Low</TableHead>
							<TableHead className="text-right">Alert</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow key={row.symbol}>
								<TableCell className="text-left">
									<button
										onClick={() => handleRemove(row.symbol)}
										disabled={isPending && pendingSymbol === row.symbol}
										aria-busy={isPending && pendingSymbol === row.symbol}
										className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#FDD458]/40 bg-[#FDD458]/10 text-[#FDD458] transition hover:bg-[#FDD458]/20 disabled:opacity-60"
										title="Remove from watchlist"
									>
										{isPending && pendingSymbol === row.symbol ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Star className="h-4 w-4" />
										)}
									</button>
								</TableCell>
								<TableCell className="font-medium text-[#F5F5F5]">{row.company}</TableCell>
								<TableCell className="text-[#A1A1A1]">{row.symbol}</TableCell>
								<TableCell className="mono text-[#FDD458]">{row.aiScore != null ? `${row.aiScore}/100` : '—'}</TableCell>
								<TableCell className="text-[#F5F5F5]">{formatCurrency(row.price)}</TableCell>
								<TableCell className={clsx(
									'mono text-sm',
									typeof row.changePercent === 'number'
										? row.changePercent >= 0
											? 'text-[#22C55E]'
											: 'text-[#EF4444]'
										: 'text-[#6E6E6E]'
								)}>
									{typeof row.changePercent === 'number' ? `${row.changePercent.toFixed(2)}%` : '-'}
								</TableCell>
								<TableCell className="text-[#A1A1A1]">{formatPrice(row.dayHigh)}</TableCell>
								<TableCell className="text-[#A1A1A1]">{formatPrice(row.dayLow)}</TableCell>
								<TableCell className="text-right">
									<Button
										variant="secondary"
										size="sm"
										className="bg-[#FDD458] text-[#0A0A0A] hover:bg-[#E8BA40]"
										onClick={() => onAddAlert?.(row)}
									>
										Add Alert
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		);
	}, [rows, isPending, pendingSymbol]);

	return content;
};

export default WatchlistTable;
