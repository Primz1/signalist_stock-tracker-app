"""Extra technical indicators via the `ta` library (bukosabino)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pandas as pd
from ta.momentum import StochasticOscillator, WilliamsRIndicator
from ta.trend import ADXIndicator, CCIIndicator
from ta.volatility import AverageTrueRange
from ta.volume import MFIIndicator

from quant.data.series import get_daily_ohlcv

ALLOWLIST = ("adx", "stoch_k", "stoch_d", "cci", "willr", "mfi", "atr", "adx_pos", "adx_neg")

DEFAULT_KEYS = ("adx", "stoch_k", "stoch_d", "cci", "willr", "mfi", "atr", "adx_pos", "adx_neg")


def _last(series: pd.Series) -> float | None:
    if series is None or series.empty:
        return None
    val = series.dropna()
    if val.empty:
        return None
    try:
        out = float(val.iloc[-1])
        if pd.isna(out):
            return None
        return out
    except Exception:
        return None


def compute_ta_latest(df: pd.DataFrame, keys: list[str] | None = None) -> dict[str, float | None]:
    """Compute allowlisted indicator latest values from OHLCV DataFrame."""
    wanted = [k for k in (keys or list(DEFAULT_KEYS)) if k in ALLOWLIST]
    if not wanted:
        wanted = list(DEFAULT_KEYS)

    out: dict[str, float | None] = {k: None for k in wanted}
    if df is None or df.empty or len(df) < 20:
        return out

    high = df["high"]
    low = df["low"]
    close = df["close"]
    volume = df["volume"] if "volume" in df.columns else pd.Series(0, index=df.index)

    computed: dict[str, float | None] = {}

    try:
        adx_i = ADXIndicator(high=high, low=low, close=close, window=14, fillna=False)
        computed["adx"] = _last(adx_i.adx())
        computed["adx_pos"] = _last(adx_i.adx_pos())
        computed["adx_neg"] = _last(adx_i.adx_neg())
    except Exception:
        computed["adx"] = computed["adx_pos"] = computed["adx_neg"] = None

    try:
        stoch = StochasticOscillator(
            high=high, low=low, close=close, window=14, smooth_window=3, fillna=False
        )
        computed["stoch_k"] = _last(stoch.stoch())
        computed["stoch_d"] = _last(stoch.stoch_signal())
    except Exception:
        computed["stoch_k"] = computed["stoch_d"] = None

    try:
        computed["cci"] = _last(CCIIndicator(high=high, low=low, close=close, window=20).cci())
    except Exception:
        computed["cci"] = None

    try:
        computed["willr"] = _last(WilliamsRIndicator(high=high, low=low, close=close, lbp=14).williams_r())
    except Exception:
        computed["willr"] = None

    try:
        computed["mfi"] = _last(
            MFIIndicator(high=high, low=low, close=close, volume=volume, window=14).money_flow_index()
        )
    except Exception:
        computed["mfi"] = None

    try:
        computed["atr"] = _last(AverageTrueRange(high=high, low=low, close=close, window=14).average_true_range())
    except Exception:
        computed["atr"] = None

    for k in wanted:
        out[k] = computed.get(k)
    return out


async def build_indicators_response(
    symbol: str,
    indicators: list[str] | None = None,
    lookback_days: int = 370,
) -> dict[str, Any]:
    sym = symbol.upper()
    df = await get_daily_ohlcv(sym, lookback_days)
    latest = compute_ta_latest(df, indicators)
    return {
        "symbol": sym,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "latest": latest,
        "bar_count": int(len(df)) if df is not None else 0,
    }
