from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from quant.config import QuantConfig, load_config
from quant.composites.symbol_snapshot import build_symbol_snapshot
from quant.data.series import get_daily_ohlcv, get_fundamentals
from quant.factors.core import (
    average_pairwise_correlation,
    herfindahl,
    max_drawdown,
    portfolio_vol_covariance,
    realized_vol_annualized,
)
from quant.rules.engine import evaluate_rules
from quant.types import (
    Concentration,
    Drawdown,
    Efficiency,
    Holding,
    PLAttribution,
    PLContribution,
    PortfolioQuantSnapshot,
    PortfolioRisk,
    SectorAllocation,
    SymbolQuantSnapshot,
)


async def build_portfolio_snapshot(
    cash: float,
    holdings_raw: list[dict[str, Any]],
    config: QuantConfig | None = None,
) -> tuple[PortfolioQuantSnapshot, dict[str, SymbolQuantSnapshot]]:
    cfg = config or load_config()
    now = datetime.now(timezone.utc).isoformat()

    enriched: list[Holding] = []
    symbol_snaps: dict[str, SymbolQuantSnapshot] = {}
    price_frames: dict[str, pd.Series] = {}

    for h in holdings_raw:
        sym = str(h.get("symbol", "")).upper()
        if not sym:
            continue
        qty = float(h.get("quantity") or h.get("qty") or 0)
        avg_cost = float(h.get("avgCost") or h.get("avg_cost") or 0)
        price = float(h.get("price") or h.get("current_price") or avg_cost)
        value = float(h.get("value") or price * qty)
        pl = float(h.get("pl") if h.get("pl") is not None else (price - avg_cost) * qty)
        pl_pct = ((price - avg_cost) / avg_cost) if avg_cost else 0.0

        snap = await build_symbol_snapshot(sym, cfg)
        symbol_snaps[sym] = snap
        fundamentals = await get_fundamentals(sym)
        sector = fundamentals.get("sector")

        ohlcv = await get_daily_ohlcv(sym, cfg.medium_days + 40)
        vol = None
        if not ohlcv.empty:
            price_frames[sym] = ohlcv["close"]
            vol = realized_vol_annualized(ohlcv["close"], cfg.short_days)

        enriched.append(
            Holding(
                symbol=sym,
                qty=qty,
                avg_cost=avg_cost,
                current_price=price,
                market_value=value,
                weight=0.0,
                unrealized_pl=pl,
                unrealized_pl_pct=pl_pct,
                sector=sector,
                vol_20d_annualized=vol,
            )
        )

    invested = sum(h.market_value for h in enriched)
    nav = cash + invested
    cash_pct = (cash / nav) if nav else 1.0

    for h in enriched:
        h.weight = (h.market_value / nav) if nav else 0.0

    weights = [h.weight for h in enriched]
    hhi = herfindahl(weights)
    effective_n = (1.0 / hhi) if hhi > 0 else 0.0
    sorted_h = sorted(enriched, key=lambda x: x.weight, reverse=True)
    top1 = sorted_h[0] if sorted_h else None
    top3_w = sum(x.weight for x in sorted_h[:3])

    concentration = Concentration(
        hhi=hhi,
        effective_n=effective_n,
        top_1_symbol=top1.symbol if top1 else None,
        top_1_weight=top1.weight if top1 else 0.0,
        top_3_weight=top3_w,
    )

    winners = sorted(
        [PLContribution(symbol=h.symbol, contribution_usd=h.unrealized_pl) for h in enriched if h.unrealized_pl > 0],
        key=lambda x: x.contribution_usd,
        reverse=True,
    )[:5]
    losers = sorted(
        [PLContribution(symbol=h.symbol, contribution_usd=h.unrealized_pl) for h in enriched if h.unrealized_pl < 0],
        key=lambda x: x.contribution_usd,
    )[:5]
    total_pl = sum(h.unrealized_pl for h in enriched)
    win_sum = sum(w.contribution_usd for w in winners)
    lose_sum = sum(abs(l.contribution_usd) for l in losers)
    pl_attr = PLAttribution(
        winners=winners,
        losers=losers,
        winners_total_pct=(win_sum / abs(total_pl)) if total_pl else 0.0,
        losers_total_pct=(lose_sum / abs(total_pl)) if total_pl else 0.0,
    )

    buckets: dict[str, float] = {}
    for h in enriched:
        key = h.sector or "Unknown"
        buckets[key] = buckets.get(key, 0.0) + h.weight
    largest = max(buckets.items(), key=lambda x: x[1]) if buckets else (None, 0.0)
    sector_alloc = SectorAllocation(
        buckets=buckets,
        largest_sector=largest[0],
        largest_sector_weight=float(largest[1]),
    )

    weighted_vol = None
    if enriched:
        vols = [(h.weight, h.vol_20d_annualized) for h in enriched if h.vol_20d_annualized is not None]
        if vols:
            wsum = sum(w for w, _ in vols)
            weighted_vol = sum(w * v for w, v in vols) / wsum if wsum else None

    weighted_beta = None
    betas = []
    for h in enriched:
        b = symbol_snaps.get(h.symbol)
        if b and b.relative.beta_vs_primary_60d is not None:
            betas.append((h.weight, b.relative.beta_vs_primary_60d))
    if betas:
        wsum = sum(w for w, _ in betas)
        weighted_beta = sum(w * b for w, b in betas) / wsum if wsum else None

    cov_vol = None
    avg_corr = None
    if len(price_frames) >= 2:
        prices_df = pd.concat(price_frames, axis=1).dropna()
        symbols_order = list(price_frames.keys())
        w_vec = np.array([next(h.weight for h in enriched if h.symbol == s) for s in symbols_order])
        # Renormalize weights to invested-only for cov calc
        if w_vec.sum() > 0:
            w_vec = w_vec / w_vec.sum()
        if len(prices_df) >= cfg.min_history_days_for_correlation:
            cov_vol = portfolio_vol_covariance(w_vec, prices_df)
            avg_corr = average_pairwise_correlation(prices_df)

    risk = PortfolioRisk(
        weighted_vol_20d=weighted_vol,
        portfolio_vol_covariance=cov_vol,
        weighted_beta=weighted_beta,
        avg_pairwise_correlation=avg_corr,
    )

    # Approximate equity curve from sum of closes * qty when available
    dd = Drawdown()
    if price_frames:
        qty_map = {h.symbol: h.qty for h in enriched}
        aligned = pd.concat(price_frames, axis=1).dropna()
        if not aligned.empty:
            equity = sum(aligned[s] * qty_map[s] for s in aligned.columns) + cash
            max_dd, cur_dd, days = max_drawdown(equity)
            dd = Drawdown(max_dd=max_dd, current_dd=cur_dd, days_in_current_dd=days)

    cost_basis = sum(h.avg_cost * h.qty for h in enriched)
    efficiency = Efficiency(
        cost_basis_vs_nav_pct=((cost_basis / invested) - 1.0) if invested else 0.0,
        cash_drag_pct=None,
    )

    snapshot = PortfolioQuantSnapshot(
        computed_at=now,
        nav=nav,
        cash=cash,
        cash_pct=cash_pct,
        holdings=enriched,
        concentration=concentration,
        pl_attribution=pl_attr,
        sector_allocation=sector_alloc,
        risk=risk,
        drawdown=dd,
        efficiency=efficiency,
        rules_fired=[],
    )
    snapshot.rules_fired = evaluate_rules(snapshot, symbol_snaps, cfg)
    return snapshot, symbol_snaps
