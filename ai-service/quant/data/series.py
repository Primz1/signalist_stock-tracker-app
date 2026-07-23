from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import httpx
import pandas as pd

FINNHUB_BASE = "https://finnhub.io/api/v1"
YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"


def _token() -> str:
    return os.getenv("FINNHUB_API_KEY") or os.getenv("NEXT_PUBLIC_FINNHUB_API_KEY") or ""


def _empty() -> pd.DataFrame:
    return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])


def _from_arrays(
    opens: list, highs: list, lows: list, closes: list, volumes: list, times: list
) -> pd.DataFrame:
    if not times or not closes:
        return _empty()
    # Align lengths; drop rows with null close
    n = min(len(times), len(closes), len(opens or closes), len(highs or closes), len(lows or closes))
    vols = volumes or [0] * n
    df = pd.DataFrame(
        {
            "open": (opens or closes)[:n],
            "high": (highs or closes)[:n],
            "low": (lows or closes)[:n],
            "close": closes[:n],
            "volume": vols[:n],
            "t": times[:n],
        }
    )
    df["date"] = pd.to_datetime(df["t"], unit="s", utc=True)
    df = df.set_index("date").sort_index()
    df = df[["open", "high", "low", "close", "volume"]].astype(float)
    return df.dropna(subset=["close"])


async def _fetch_finnhub(symbol: str, lookback_days: int) -> pd.DataFrame:
    token = _token()
    if not token:
        return _empty()

    now = datetime.now(timezone.utc)
    to_ts = int(now.timestamp())
    from_ts = int((now - timedelta(days=lookback_days + 30)).timestamp())

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(
            f"{FINNHUB_BASE}/stock/candle",
            params={
                "symbol": symbol.upper(),
                "resolution": "D",
                "from": from_ts,
                "to": to_ts,
                "token": token,
            },
        )
        if res.status_code != 200:
            return _empty()
        data = res.json()

    if not data or data.get("s") != "ok":
        return _empty()

    return _from_arrays(
        data.get("o", []),
        data.get("h", []),
        data.get("l", []),
        data.get("c", []),
        data.get("v", []),
        data.get("t", []),
    )


async def _fetch_yahoo(symbol: str, lookback_days: int) -> pd.DataFrame:
    """Fallback when Finnhub candles are gated (common on free keys)."""
    if lookback_days <= 30:
        range_ = "1mo"
    elif lookback_days <= 90:
        range_ = "3mo"
    elif lookback_days <= 180:
        range_ = "6mo"
    elif lookback_days <= 400:
        range_ = "2y"
    else:
        range_ = "5y"

    url = YAHOO_CHART.format(symbol=symbol.upper())
    headers = {"User-Agent": "Mozilla/5.0 (compatible; SignalistQuant/1.0)"}
    async with httpx.AsyncClient(timeout=30, headers=headers, follow_redirects=True) as client:
        res = await client.get(url, params={"interval": "1d", "range": range_})
        if res.status_code != 200:
            return _empty()
        payload = res.json()

    try:
        result = (payload.get("chart") or {}).get("result") or []
        if not result:
            return _empty()
        block = result[0]
        times = block.get("timestamp") or []
        quote = (block.get("indicators") or {}).get("quote") or [{}]
        q = quote[0] or {}
        return _from_arrays(
            q.get("open") or [],
            q.get("high") or [],
            q.get("low") or [],
            q.get("close") or [],
            q.get("volume") or [],
            times,
        )
    except Exception:
        return _empty()


async def get_daily_ohlcv(symbol: str, lookback_days: int = 400) -> pd.DataFrame:
    """Fetch daily candles. Prefer Finnhub; fall back to Yahoo Finance chart API."""
    df = await _fetch_finnhub(symbol, lookback_days)
    if df.empty:
        df = await _fetch_yahoo(symbol, lookback_days)
    if df.empty:
        return df
    return df.tail(lookback_days)


async def get_benchmark_series(symbol: str = "SPY", lookback_days: int = 400) -> pd.DataFrame:
    return await get_daily_ohlcv(symbol, lookback_days)


async def get_fundamentals(symbol: str) -> dict:
    token = _token()
    if not token:
        return {}
    async with httpx.AsyncClient(timeout=20) as client:
        metric = await client.get(
            f"{FINNHUB_BASE}/stock/metric",
            params={"symbol": symbol.upper(), "metric": "all", "token": token},
        )
        profile = await client.get(
            f"{FINNHUB_BASE}/stock/profile2",
            params={"symbol": symbol.upper(), "token": token},
        )
    out: dict = {}
    if metric.status_code == 200:
        m = (metric.json() or {}).get("metric") or {}
        out["pe"] = m.get("peNormalizedAnnual") or m.get("peTTM")
        out["gross_margin"] = m.get("grossMarginTTM") or m.get("grossMarginAnnual")
        out["operating_margin"] = m.get("operatingMarginTTM") or m.get("operatingMarginAnnual")
        out["debt_to_equity"] = m.get("totalDebt/totalEquityAnnual") or m.get("totalDebt/totalEquityQuarterly")
        out["revenue_growth_yoy"] = m.get("revenueGrowthTTMYoy")
    if profile.status_code == 200:
        p = profile.json() or {}
        out["sector"] = p.get("finnhubIndustry") or p.get("gics") or None
        out["name"] = p.get("name")
    return out


async def get_earnings_calendar(symbol: str) -> dict:
    token = _token()
    if not token:
        return {}
    today = datetime.now(timezone.utc).date()
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.get(
            f"{FINNHUB_BASE}/calendar/earnings",
            params={
                "symbol": symbol.upper(),
                "from": today.isoformat(),
                "to": (today + timedelta(days=120)).isoformat(),
                "token": token,
            },
        )
        surprises = await client.get(
            f"{FINNHUB_BASE}/stock/earnings",
            params={"symbol": symbol.upper(), "token": token},
        )
    days = None
    if res.status_code == 200:
        rows = (res.json() or {}).get("earningsCalendar") or []
        if rows:
            try:
                next_date = datetime.strptime(rows[0]["date"], "%Y-%m-%d").date()
                days = (next_date - today).days
            except Exception:
                days = None
    surprise_list: list[float] = []
    if surprises.status_code == 200:
        for row in (surprises.json() or [])[:4]:
            if row.get("surprisePercent") is not None:
                surprise_list.append(float(row["surprisePercent"]))
    return {"days_to_next_earnings": days, "last_4_earnings_surprise_pct": surprise_list}
