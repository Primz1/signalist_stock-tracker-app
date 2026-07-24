"""QuantStats tear-sheet metrics as JSON (no HTML)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from quant.data.series import get_daily_ohlcv


def _to_series(returns: dict[str, float]) -> pd.Series:
    if not returns:
        return pd.Series(dtype=float)
    s = pd.Series(returns, dtype=float)
    s.index = pd.to_datetime(s.index, utc=True, errors="coerce")
    s = s[~s.index.isna()].sort_index()
    s = s.replace([np.inf, -np.inf], np.nan).dropna()
    # QuantStats prefers tz-naive daily index
    if getattr(s.index, "tz", None) is not None:
        s.index = s.index.tz_localize(None)
    s.index = s.index.normalize()
    return s


def _safe_float(v: Any) -> float | None:
    try:
        if v is None or (isinstance(v, float) and (np.isnan(v) or np.isinf(v))):
            return None
        out = float(v)
        if np.isnan(out) or np.isinf(out):
            return None
        return out
    except Exception:
        return None


def _drawdown_series(returns: pd.Series) -> list[dict[str, float | str]]:
    if returns.empty:
        return []
    equity = (1.0 + returns).cumprod()
    peak = equity.cummax()
    dd = equity / peak - 1.0
    out: list[dict[str, float | str]] = []
    for ts, val in dd.items():
        if pd.isna(val):
            continue
        out.append({"t": pd.Timestamp(ts).strftime("%Y-%m-%d"), "v": float(val)})
    return out


def _monthly_returns(returns: pd.Series) -> dict[str, float]:
    if returns.empty:
        return {}
    try:
        import quantstats as qs

        m = qs.stats.monthly_returns(returns)
        # quantstats may return DataFrame (years x months) or Series
        out: dict[str, float] = {}
        if isinstance(m, pd.DataFrame):
            for year, row in m.iterrows():
                for month, val in row.items():
                    if month == "EOY" or pd.isna(val):
                        continue
                    try:
                        month_num = int(month) if str(month).isdigit() else pd.Timestamp(f"2000-{month}-01").month
                    except Exception:
                        continue
                    key = f"{int(year):04d}-{int(month_num):02d}"
                    fv = _safe_float(val)
                    if fv is not None:
                        out[key] = fv
        elif isinstance(m, pd.Series):
            for idx, val in m.items():
                fv = _safe_float(val)
                if fv is None:
                    continue
                if isinstance(idx, tuple) and len(idx) >= 2:
                    out[f"{int(idx[0]):04d}-{int(idx[1]):02d}"] = fv
                else:
                    out[str(idx)] = fv
        return out
    except Exception:
        # Fallback: resample manually
        try:
            m = (1.0 + returns).resample("ME").prod() - 1.0
            return {
                ts.strftime("%Y-%m"): float(v)
                for ts, v in m.items()
                if not pd.isna(v)
            }
        except Exception:
            return {}


async def build_tearsheet(
    returns: dict[str, float],
    benchmark: str | None = None,
    benchmark_returns: dict[str, float] | None = None,
    title: str | None = None,
) -> dict[str, Any]:
    rets = _to_series(returns)
    if len(rets) < 5:
        return {
            "title": title or "Paper portfolio",
            "computed_at": datetime.now(timezone.utc).isoformat(),
            "enough_history": False,
            "metrics": {},
            "monthly_returns": {},
            "drawdown_series": [],
            "message": "Not enough daily returns yet (need ~5+ trading days).",
        }

    bench_s: pd.Series | None = None
    if benchmark_returns:
        bench_s = _to_series(benchmark_returns)
    elif benchmark:
        try:
            df = await get_daily_ohlcv(benchmark.upper(), max(400, len(rets) + 30))
            if not df.empty:
                b = df["close"].pct_change().dropna()
                if getattr(b.index, "tz", None) is not None:
                    b.index = b.index.tz_localize(None)
                b.index = b.index.normalize()
                # Align to portfolio return dates
                bench_s = b.reindex(rets.index).dropna()
                # Re-align portfolio to overlapping dates for fair metrics
                joined = pd.concat([rets.rename("p"), bench_s.rename("b")], axis=1).dropna()
                if len(joined) >= 5:
                    rets = joined["p"]
                    bench_s = joined["b"]
                else:
                    bench_s = None
        except Exception:
            bench_s = None

    metrics: dict[str, float | None] = {}
    try:
        import quantstats as qs

        metrics["cagr"] = _safe_float(qs.stats.cagr(rets))
        metrics["sharpe"] = _safe_float(qs.stats.sharpe(rets))
        metrics["sortino"] = _safe_float(qs.stats.sortino(rets))
        metrics["max_drawdown"] = _safe_float(qs.stats.max_drawdown(rets))
        metrics["volatility"] = _safe_float(qs.stats.volatility(rets))
        metrics["best_day"] = _safe_float(qs.stats.best(rets))
        metrics["worst_day"] = _safe_float(qs.stats.worst(rets))
        metrics["skew"] = _safe_float(qs.stats.skew(rets))
        try:
            metrics["win_rate"] = _safe_float(qs.stats.win_rate(rets))
        except Exception:
            wins = (rets > 0).sum()
            metrics["win_rate"] = float(wins / len(rets)) if len(rets) else None
        if bench_s is not None and len(bench_s) >= 5:
            try:
                metrics["alpha"] = _safe_float(qs.stats.greeks(rets, bench_s).get("alpha"))
            except Exception:
                pass
            try:
                metrics["beta"] = _safe_float(qs.stats.greeks(rets, bench_s).get("beta"))
            except Exception:
                pass
    except Exception as exc:
        # Minimal fallback without quantstats
        vol = float(rets.std() * np.sqrt(252)) if len(rets) > 1 else None
        mean = float(rets.mean() * 252) if len(rets) else None
        metrics = {
            "cagr": None,
            "sharpe": (mean / vol) if mean is not None and vol and vol > 0 else None,
            "sortino": None,
            "max_drawdown": float(((1 + rets).cumprod() / (1 + rets).cumprod().cummax() - 1).min())
            if len(rets)
            else None,
            "volatility": vol,
            "best_day": float(rets.max()) if len(rets) else None,
            "worst_day": float(rets.min()) if len(rets) else None,
            "skew": float(rets.skew()) if len(rets) > 2 else None,
            "win_rate": float((rets > 0).mean()) if len(rets) else None,
        }
        _ = exc

    return {
        "title": title or "Paper portfolio",
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "enough_history": True,
        "metrics": metrics,
        "monthly_returns": _monthly_returns(rets),
        "drawdown_series": _drawdown_series(rets),
        "day_count": int(len(rets)),
    }
