/** Lean trade shape used when reconstructing realized P/L from history. */
export type ReplayTrade = {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  avgCostAtSale?: number | null;
  realizedPl?: number | null;
  timestamp: string | Date;
  undoneAt?: string | Date | null;
};

export type RealizedEnrichment = {
  avgCostAtSale?: number;
  realizedPl?: number;
};

/**
 * Replay non-undone trades chronologically with running average cost
 * (same semantics as executeTrade) so legacy sells without realizedPl
 * get reconstructed values. Stored fields win when present.
 */
export function computeRealizedByTradeId(
  trades: ReplayTrade[]
): Map<string, RealizedEnrichment> {
  const byId = new Map<string, RealizedEnrichment>();
  const positions = new Map<string, { quantity: number; avgCost: number }>();

  const chronological = [...trades].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const t of chronological) {
    if (t.undoneAt) continue;

    const symbol = String(t.symbol).toUpperCase();
    const qty = Number(t.quantity);
    const price = Number(t.price);

    if (t.side === 'buy') {
      const pos = positions.get(symbol);
      if (pos) {
        const newQty = pos.quantity + qty;
        pos.avgCost = (pos.avgCost * pos.quantity + price * qty) / newQty;
        pos.quantity = newQty;
      } else {
        positions.set(symbol, { quantity: qty, avgCost: price });
      }
      continue;
    }

    const pos = positions.get(symbol);
    const storedAvg =
      t.avgCostAtSale != null && Number.isFinite(Number(t.avgCostAtSale))
        ? Number(t.avgCostAtSale)
        : undefined;
    const avgCostAtSale = storedAvg ?? (pos ? pos.avgCost : undefined);
    const storedPl =
      t.realizedPl != null && Number.isFinite(Number(t.realizedPl))
        ? Number(t.realizedPl)
        : undefined;
    const realizedPl =
      storedPl ??
      (avgCostAtSale != null ? (price - avgCostAtSale) * qty : undefined);

    byId.set(t.id, {
      ...(avgCostAtSale != null ? { avgCostAtSale } : {}),
      ...(realizedPl != null ? { realizedPl } : {}),
    });

    if (pos) {
      pos.quantity -= qty;
      if (pos.quantity <= 1e-9) positions.delete(symbol);
    }
  }

  return byId;
}
