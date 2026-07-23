from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Literal

from quant.config import QuantConfig
from quant.types import FiredRule, PortfolioQuantSnapshot, SymbolQuantSnapshot


@dataclass
class Rule:
    id: str
    tag: Literal["trim", "add", "exit", "watch"]
    condition: Callable[[PortfolioQuantSnapshot, dict[str, SymbolQuantSnapshot], QuantConfig], bool]
    message_fn: Callable[
        [PortfolioQuantSnapshot, dict[str, SymbolQuantSnapshot], QuantConfig],
        tuple[str, dict],
    ]


def _stop_loss_msg(p: PortfolioQuantSnapshot, cfg: QuantConfig) -> tuple[str, dict]:
    hits = [h for h in p.holdings if h.unrealized_pl_pct <= cfg.stop_loss_pct]
    if not hits:
        return ("No stop-loss hits.", {})
    h = hits[0]
    return (
        f"{h.symbol} is {h.unrealized_pl_pct:.0%} from avg cost (soft stop {cfg.stop_loss_pct:.0%}).",
        {"symbol": h.symbol, "pl_pct": h.unrealized_pl_pct, "threshold": cfg.stop_loss_pct},
    )


def _rsi_fade_msg(
    p: PortfolioQuantSnapshot, s: dict[str, SymbolQuantSnapshot], cfg: QuantConfig
) -> tuple[str, dict]:
    hits = [
        h.symbol
        for h in p.holdings
        if (snap := s.get(h.symbol))
        and snap.momentum.rsi_14 is not None
        and snap.momentum.rsi_14 > cfg.rsi_overbought
        and (snap.momentum.macd_hist_slope_5 or 0) < 0
    ]
    if not hits:
        return ("No RSI fade hits.", {})
    return (
        f"{hits[0]} RSI is overbought with fading MACD — Signalist noticed stretch risk.",
        {"symbol": hits[0]},
    )


def _add_cash_msg(
    p: PortfolioQuantSnapshot, s: dict[str, SymbolQuantSnapshot]
) -> tuple[str, dict]:
    hits = [sym for sym, snap in s.items() if snap.score.total > 75]
    if not hits:
        return ("No high-score names with elevated cash.", {})
    return (
        f"Cash is elevated ({p.cash_pct:.0%}) and {hits[0]} scores {s[hits[0]].score.total}/100.",
        {"symbol": hits[0], "score": s[hits[0]].score.total, "cash_pct": p.cash_pct},
    )


def _all_rules() -> list[Rule]:
    return [
        Rule(
            id="trim_top_weight",
            tag="trim",
            condition=lambda p, s, cfg: p.concentration.top_1_weight > cfg.trim_weight_threshold,
            message_fn=lambda p, s, cfg: (
                f"{p.concentration.top_1_symbol} at {p.concentration.top_1_weight:.0%} "
                f"exceeds your {cfg.trim_weight_threshold:.0%} concentration ceiling.",
                {
                    "symbol": p.concentration.top_1_symbol,
                    "weight": p.concentration.top_1_weight,
                    "threshold": cfg.trim_weight_threshold,
                },
            ),
        ),
        Rule(
            id="cash_reserve_low",
            tag="watch",
            condition=lambda p, s, cfg: p.cash_pct < cfg.cash_reserve_min,
            message_fn=lambda p, s, cfg: (
                f"Cash at {p.cash_pct:.0%} — below your {cfg.cash_reserve_min:.0%} reserve target.",
                {"cash_pct": p.cash_pct, "target": cfg.cash_reserve_min},
            ),
        ),
        Rule(
            id="correlation_cluster",
            tag="watch",
            condition=lambda p, s, cfg: (
                p.risk.avg_pairwise_correlation is not None
                and p.risk.avg_pairwise_correlation > cfg.correlation_cluster_threshold
            ),
            message_fn=lambda p, s, cfg: (
                f"Average correlation across holdings is {p.risk.avg_pairwise_correlation:.2f} — "
                f"you may be exposed to one factor more than position count suggests.",
                {"avg_corr": p.risk.avg_pairwise_correlation},
            ),
        ),
        Rule(
            id="stop_loss_soft",
            tag="exit",
            condition=lambda p, s, cfg: any(h.unrealized_pl_pct <= cfg.stop_loss_pct for h in p.holdings),
            message_fn=lambda p, s, cfg: _stop_loss_msg(p, cfg),
        ),
        Rule(
            id="rsi_overbought_fade",
            tag="trim",
            condition=lambda p, s, cfg: any(
                (snap := s.get(h.symbol))
                and snap.momentum.rsi_14 is not None
                and snap.momentum.rsi_14 > cfg.rsi_overbought
                and (snap.momentum.macd_hist_slope_5 or 0) < 0
                for h in p.holdings
            ),
            message_fn=lambda p, s, cfg: _rsi_fade_msg(p, s, cfg),
        ),
        Rule(
            id="concentration_sector",
            tag="watch",
            condition=lambda p, s, cfg: p.sector_allocation.largest_sector_weight > cfg.sector_max_weight,
            message_fn=lambda p, s, cfg: (
                f"{p.sector_allocation.largest_sector} is {p.sector_allocation.largest_sector_weight:.0%} "
                f"of the book (ceiling {cfg.sector_max_weight:.0%}).",
                {
                    "sector": p.sector_allocation.largest_sector,
                    "weight": p.sector_allocation.largest_sector_weight,
                    "threshold": cfg.sector_max_weight,
                },
            ),
        ),
        Rule(
            id="add_high_score_high_cash",
            tag="add",
            condition=lambda p, s, cfg: p.cash_pct > 0.20
            and any(snap.score.total > 75 for snap in s.values()),
            message_fn=lambda p, s, cfg: _add_cash_msg(p, s),
        ),
    ]


def evaluate_rules(
    portfolio: PortfolioQuantSnapshot,
    per_symbol: dict[str, SymbolQuantSnapshot],
    config: QuantConfig,
) -> list[FiredRule]:
    fired: list[FiredRule] = []
    for rule in _all_rules():
        try:
            if rule.condition(portfolio, per_symbol, config):
                msg, data = rule.message_fn(portfolio, per_symbol, config)
                fired.append(FiredRule(id=rule.id, tag=rule.tag, message=msg, data=data))
        except Exception:
            continue
    return fired
