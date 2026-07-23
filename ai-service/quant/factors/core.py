from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd


def period_return(closes: pd.Series, days: int) -> Optional[float]:
    if len(closes) < days + 1:
        return None
    a, b = float(closes.iloc[-days - 1]), float(closes.iloc[-1])
    if a == 0:
        return None
    return (b / a) - 1.0


def ytd_return(closes: pd.Series) -> Optional[float]:
    if closes.empty:
        return None
    year = closes.index[-1].year
    ytd = closes[closes.index.year == year]
    if len(ytd) < 2:
        return None
    a, b = float(ytd.iloc[0]), float(ytd.iloc[-1])
    if a == 0:
        return None
    return (b / a) - 1.0


def log_return_mean(closes: pd.Series, window: int = 20) -> Optional[float]:
    if len(closes) < window + 1:
        return None
    lr = np.log(closes / closes.shift(1)).tail(window)
    val = lr.mean()
    return None if pd.isna(val) else float(val)


def sma(closes: pd.Series, period: int) -> Optional[float]:
    if len(closes) < period:
        return None
    return float(closes.tail(period).mean())


def rsi(closes: pd.Series, period: int = 14) -> Optional[float]:
    if len(closes) < period + 1:
        return None
    delta = closes.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()
    last_gain = float(avg_gain.iloc[-1])
    last_loss = float(avg_loss.iloc[-1])
    if last_loss == 0:
        return 100.0 if last_gain > 0 else 50.0
    rs = last_gain / last_loss
    return float(100 - 100 / (1 + rs))


def macd_hist_and_slope(closes: pd.Series, fast=12, slow=26, signal=9, slope_n=5):
    if len(closes) < slow + signal:
        return None, None
    ema_fast = closes.ewm(span=fast, adjust=False).mean()
    ema_slow = closes.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    hist = macd_line - signal_line
    hist_val = float(hist.iloc[-1])
    recent = hist.tail(slope_n).values
    if len(recent) < slope_n:
        return hist_val, None
    x = np.arange(len(recent))
    slope = float(np.polyfit(x, recent, 1)[0])
    return hist_val, slope


def roc(closes: pd.Series, period: int = 20) -> Optional[float]:
    return period_return(closes, period)


def realized_vol_annualized(closes: pd.Series, window: int = 20) -> Optional[float]:
    if len(closes) < window + 1:
        return None
    log_ret = np.log(closes / closes.shift(1))
    vol = log_ret.rolling(window).std().iloc[-1] * np.sqrt(252)
    return None if pd.isna(vol) else float(vol)


def atr(df: pd.DataFrame, period: int = 14) -> Optional[float]:
    if len(df) < period + 1:
        return None
    high, low, close = df["high"], df["low"], df["close"]
    prev_close = close.shift(1)
    tr = pd.concat(
        [(high - low), (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    val = tr.ewm(alpha=1 / period, adjust=False).mean().iloc[-1]
    return None if pd.isna(val) else float(val)


def bollinger(closes: pd.Series, period: int = 20, std_mult: float = 2.0):
    if len(closes) < period:
        return None, None, None, None, None
    mid = closes.rolling(period).mean()
    sd = closes.rolling(period).std()
    upper = mid + std_mult * sd
    lower = mid - std_mult * sd
    m, u, l, c = float(mid.iloc[-1]), float(upper.iloc[-1]), float(lower.iloc[-1]), float(closes.iloc[-1])
    width = u - l
    pct_b = None if width == 0 else (c - l) / width
    bandwidth = None if m == 0 else width / m
    return m, u, l, pct_b, bandwidth


def parkinson_vol(df: pd.DataFrame, window: int = 20) -> Optional[float]:
    if len(df) < window:
        return None
    hl = np.log(df["high"] / df["low"]).tail(window)
    # Parkinson estimator annualized
    const = 1.0 / (4.0 * np.log(2.0))
    var = const * (hl**2).mean()
    return float(np.sqrt(var * 252))


def volume_ratio(volume: pd.Series, window: int = 20) -> Optional[float]:
    if len(volume) < window + 1:
        return None
    avg = float(volume.tail(window + 1).iloc[:-1].mean())
    if avg == 0:
        return None
    return float(volume.iloc[-1] / avg)


def obv_slope(closes: pd.Series, volume: pd.Series, window: int = 20) -> Optional[float]:
    if len(closes) < window + 1 or len(volume) < window + 1:
        return None
    direction = np.sign(closes.diff().fillna(0))
    obv = (direction * volume).cumsum()
    recent = obv.tail(window).values
    x = np.arange(len(recent))
    return float(np.polyfit(x, recent, 1)[0])


def swing_points(series: pd.Series, kind: str = "high", lookback: int = 2) -> list[float]:
    vals = series.values
    out: list[float] = []
    for i in range(lookback, len(vals) - lookback):
        window = vals[i - lookback : i + lookback + 1]
        if kind == "high" and vals[i] == np.max(window):
            out.append(float(vals[i]))
        if kind == "low" and vals[i] == np.min(window):
            out.append(float(vals[i]))
    return out[-3:]


def recent_cross(fast: pd.Series, slow: pd.Series, within: int = 20) -> tuple[bool, bool]:
    """Returns (golden_cross_recent, death_cross_recent)."""
    if len(fast) < within + 2 or len(slow) < within + 2:
        return False, False
    diff = fast - slow
    golden = False
    death = False
    tail = diff.tail(within + 1)
    for i in range(1, len(tail)):
        prev, cur = float(tail.iloc[i - 1]), float(tail.iloc[i])
        if prev <= 0 < cur:
            golden = True
        if prev >= 0 > cur:
            death = True
    return golden, death


def beta_vs(asset: pd.Series, bench: pd.Series, window: int = 60) -> Optional[float]:
    if len(asset) < window + 1 or len(bench) < window + 1:
        return None
    a = np.log(asset / asset.shift(1)).tail(window)
    b = np.log(bench / bench.shift(1)).tail(window)
    df = pd.concat([a.rename("a"), b.rename("b")], axis=1).dropna()
    if len(df) < window // 2:
        return None
    var_b = df["b"].var()
    if not var_b or pd.isna(var_b):
        return None
    return float(df["a"].cov(df["b"]) / var_b)


def correlation_vs(asset: pd.Series, bench: pd.Series, window: int = 60) -> Optional[float]:
    if len(asset) < window + 1 or len(bench) < window + 1:
        return None
    a = np.log(asset / asset.shift(1)).tail(window)
    b = np.log(bench / bench.shift(1)).tail(window)
    df = pd.concat([a.rename("a"), b.rename("b")], axis=1).dropna()
    if len(df) < window // 2:
        return None
    val = df["a"].corr(df["b"])
    return None if pd.isna(val) else float(val)


def herfindahl(weights: list[float]) -> float:
    if not weights:
        return 0.0
    return float(sum(w * w for w in weights))


def max_drawdown(equity: pd.Series) -> tuple[Optional[float], Optional[float], Optional[int]]:
    if len(equity) < 2:
        return None, None, None
    running_max = equity.cummax()
    dd = (equity / running_max) - 1
    max_dd = float(dd.min())
    current_dd = float(dd.iloc[-1])
    days = 0
    for v in reversed(dd.values):
        if v < 0:
            days += 1
        else:
            break
    return max_dd, current_dd, days


def portfolio_vol_covariance(weights: np.ndarray, prices_df: pd.DataFrame) -> Optional[float]:
    if len(prices_df) < 30 or len(weights) != prices_df.shape[1]:
        return None
    log_ret = np.log(prices_df / prices_df.shift(1)).dropna()
    if len(log_ret) < 30:
        return None
    cov = log_ret.cov() * 252
    port_var = float(weights @ cov.values @ weights)
    if port_var < 0:
        return None
    return float(np.sqrt(port_var))


def average_pairwise_correlation(prices_df: pd.DataFrame) -> Optional[float]:
    if prices_df.shape[1] < 2 or len(prices_df) < 30:
        return None
    log_ret = np.log(prices_df / prices_df.shift(1)).dropna()
    corr = log_ret.corr()
    n = corr.shape[0]
    off = corr.values.sum() - np.trace(corr.values)
    count = n * (n - 1)
    if count == 0:
        return None
    return float(off / count)
