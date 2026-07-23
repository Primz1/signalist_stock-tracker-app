from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml


@dataclass
class QuantConfig:
    short_days: int = 20
    medium_days: int = 60
    long_days: int = 252
    correlation_window_days: int = 90
    min_history_days_for_beta: int = 60
    min_history_days_for_correlation: int = 30
    score_weights: dict[str, float] = field(
        default_factory=lambda: {
            "trend": 0.25,
            "momentum": 0.20,
            "volatility_inv": 0.15,
            "volume": 0.10,
            "relative": 0.15,
            "quality": 0.10,
            "event_penalty": 0.05,
        }
    )
    trim_weight_threshold: float = 0.25
    cash_reserve_min: float = 0.10
    stop_loss_pct: float = -0.15
    rsi_overbought: float = 80
    rsi_oversold: float = 25
    sector_max_weight: float = 0.40
    correlation_cluster_threshold: float = 0.85
    primary_benchmark: str = "SPY"
    sector_map: dict[str, str] = field(
        default_factory=lambda: {
            "Technology": "XLK",
            "Financials": "XLF",
            "Healthcare": "XLV",
            "Energy": "XLE",
            "Consumer Discretionary": "XLY",
            "Consumer Staples": "XLP",
            "Industrials": "XLI",
            "Materials": "XLB",
            "Utilities": "XLU",
            "Real Estate": "XLRE",
            "Communication Services": "XLC",
        }
    )


def _from_yaml(raw: dict[str, Any]) -> QuantConfig:
    lookbacks = raw.get("lookbacks") or {}
    data = raw.get("data") or {}
    rules = raw.get("rules") or {}
    benchmarks = raw.get("benchmarks") or {}
    weights = raw.get("score_weights") or {}

    cfg = QuantConfig(
        short_days=int(lookbacks.get("short_days", 20)),
        medium_days=int(lookbacks.get("medium_days", 60)),
        long_days=int(lookbacks.get("long_days", 252)),
        correlation_window_days=int(lookbacks.get("correlation_window_days", 90)),
        min_history_days_for_beta=int(data.get("min_history_days_for_beta", 60)),
        min_history_days_for_correlation=int(data.get("min_history_days_for_correlation", 30)),
        trim_weight_threshold=float(rules.get("trim_weight_threshold", 0.25)),
        cash_reserve_min=float(rules.get("cash_reserve_min", 0.10)),
        stop_loss_pct=float(rules.get("stop_loss_pct", -0.15)),
        rsi_overbought=float(rules.get("rsi_overbought", 80)),
        rsi_oversold=float(rules.get("rsi_oversold", 25)),
        sector_max_weight=float(rules.get("sector_max_weight", 0.40)),
        correlation_cluster_threshold=float(rules.get("correlation_cluster_threshold", 0.85)),
        primary_benchmark=str(benchmarks.get("primary", "SPY")),
        sector_map=dict(benchmarks.get("sector_map") or QuantConfig().sector_map),
        score_weights=dict(weights) if weights else QuantConfig().score_weights,
    )

    total_w = sum(cfg.score_weights.values())
    if abs(total_w - 1.0) > 0.02:
        # Normalize rather than crash on misconfigured yaml
        cfg.score_weights = {k: v / total_w for k, v in cfg.score_weights.items()}
    return cfg


@lru_cache(maxsize=1)
def load_config() -> QuantConfig:
    path = Path(__file__).with_name("config.yaml")
    if path.exists():
        with path.open("r", encoding="utf-8") as f:
            return _from_yaml(yaml.safe_load(f) or {})
    return QuantConfig()
