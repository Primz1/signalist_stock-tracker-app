from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd

from quant.config import QuantConfig, load_config
from quant.data.series import (
    get_benchmark_series,
    get_daily_ohlcv,
    get_earnings_calendar,
    get_fundamentals,
    is_crypto_symbol,
)
from quant.factors.core import (
    atr,
    beta_vs,
    bollinger,
    correlation_vs,
    log_return_mean,
    macd_hist_and_slope,
    obv_slope,
    parkinson_vol,
    period_return,
    realized_vol_annualized,
    recent_cross,
    roc,
    rsi,
    sma,
    swing_points,
    volume_ratio,
    ytd_return,
)
from quant.types import (
    DataQuality,
    Quality,
    SymbolEvent,
    SymbolExtras,
    SymbolLevels,
    SymbolMomentum,
    SymbolQuality,
    SymbolQuantSnapshot,
    SymbolRelative,
    SymbolReturns,
    SymbolScore,
    SymbolTrend,
    SymbolVolatility,
    SymbolVolume,
)
from quant.ta_indicators import compute_ta_latest


def _quality_score(fundamentals: dict) -> float:
    """Map available fundamentals into a 0–1 quality factor (neutral 0.5 when sparse)."""
    scores: list[float] = []
    pe = fundamentals.get("pe")
    if isinstance(pe, (int, float)) and pe > 0:
        if pe < 15:
            scores.append(0.85)
        elif pe < 25:
            scores.append(0.65)
        elif pe < 40:
            scores.append(0.4)
        else:
            scores.append(0.2)
    gm = fundamentals.get("gross_margin")
    if isinstance(gm, (int, float)):
        scores.append(max(0.0, min(1.0, float(gm))))
    om = fundamentals.get("operating_margin")
    if isinstance(om, (int, float)):
        scores.append(max(0.0, min(1.0, 0.5 + float(om))))
    de = fundamentals.get("debt_to_equity")
    if isinstance(de, (int, float)) and de >= 0:
        scores.append(max(0.0, min(1.0, 1.0 - float(de) / 3.0)))
    rg = fundamentals.get("revenue_growth_yoy")
    if isinstance(rg, (int, float)):
        scores.append(max(0.0, min(1.0, 0.5 + float(rg))))
    if not scores:
        return 0.5
    return sum(scores) / len(scores)


def _score_from_parts(
    cfg: QuantConfig,
    trend_signal: float,
    rsi_14: float | None,
    realized_vol: float | None,
    vol_ratio: float | None,
    excess_1m: float | None,
    days_to_earn: int | None,
    quality_signal: float = 0.5,
) -> SymbolScore:
    """Store raw 0–1 factor scores in `components`; apply weights only for `total`."""
    w = cfg.score_weights
    raw: dict[str, float] = {}
    raw["trend"] = max(0.0, min(1.0, trend_signal))

    if rsi_14 is not None:
        raw["momentum"] = max(0.0, min(1.0, 1.0 - abs(rsi_14 - 55) / 55))
    else:
        raw["momentum"] = 0.5

    if realized_vol is not None:
        raw["volatility_inv"] = max(0.0, min(1.0, 1.0 - (realized_vol - 0.15) / 0.45))
    else:
        raw["volatility_inv"] = 0.5

    if vol_ratio is not None:
        raw["volume"] = max(0.0, min(1.0, (vol_ratio - 0.5) / 1.5))
    else:
        raw["volume"] = 0.5

    if excess_1m is not None:
        raw["relative"] = max(0.0, min(1.0, 0.5 + excess_1m * 5))
    else:
        raw["relative"] = 0.5

    raw["quality"] = max(0.0, min(1.0, quality_signal))

    if days_to_earn is not None and days_to_earn < 3:
        raw["event_penalty"] = -0.5
    else:
        raw["event_penalty"] = 0.0

    weighted = sum(raw.get(k, 0.0) * w.get(k, 0.0) for k in w)
    total = int(round(weighted * 100))
    return SymbolScore(total=max(0, min(100, total)), components=raw)


async def build_symbol_snapshot(
    symbol: str,
    config: QuantConfig | None = None,
) -> SymbolQuantSnapshot:
    cfg = config or load_config()
    sym = symbol.upper()
    df = await get_daily_ohlcv(sym, cfg.long_days + 50)
    bench = await get_benchmark_series(cfg.primary_benchmark, cfg.long_days + 50)
    fundamentals = await get_fundamentals(sym)
    earnings = await get_earnings_calendar(sym)

    quality = Quality()
    if df.empty or len(df) < 25:
        quality = Quality(
            returns=DataQuality.MISSING,
            trend=DataQuality.MISSING,
            momentum=DataQuality.MISSING,
            volatility=DataQuality.MISSING,
            volume=DataQuality.MISSING,
            levels=DataQuality.MISSING,
            relative=DataQuality.MISSING,
            quality=DataQuality.MISSING if not fundamentals else DataQuality.PARTIAL,
            event=DataQuality.PARTIAL,
        )
        price = float(df["close"].iloc[-1]) if not df.empty else 0.0
        snap = SymbolQuantSnapshot(
            symbol=sym,
            computed_at=datetime.now(timezone.utc).isoformat(),
            returns=SymbolReturns(),
            trend=SymbolTrend(price=price),
            momentum=SymbolMomentum(),
            volatility=SymbolVolatility(),
            volume=SymbolVolume(),
            levels=SymbolLevels(),
            relative=SymbolRelative(),
            quality=SymbolQuality(
                pe=fundamentals.get("pe"),
                gross_margin=fundamentals.get("gross_margin"),
                operating_margin=fundamentals.get("operating_margin"),
                debt_to_equity=fundamentals.get("debt_to_equity"),
                revenue_growth_yoy=fundamentals.get("revenue_growth_yoy"),
            ),
            event=SymbolEvent(
                days_to_next_earnings=earnings.get("days_to_next_earnings"),
                last_4_earnings_surprise_pct=earnings.get("last_4_earnings_surprise_pct") or [],
            ),
            score=SymbolScore(total=50, components={}),
            data_quality=quality,
        )
        return snap

    closes = df["close"]
    price = float(closes.iloc[-1])

    returns = SymbolReturns(
        r_1d=period_return(closes, 1),
        r_1w=period_return(closes, 5),
        r_1m=period_return(closes, 21),
        r_3m=period_return(closes, 63),
        r_ytd=ytd_return(closes),
        log_return_mean_20d=log_return_mean(closes, cfg.short_days),
    )

    sma20 = sma(closes, 20)
    sma50 = sma(closes, 50)
    sma200 = sma(closes, 200)
    sma20_s = closes.rolling(20).mean()
    sma50_s = closes.rolling(50).mean()
    sma200_s = closes.rolling(200).mean()
    golden, death = False, False
    if len(closes) >= 220:
        golden, death = recent_cross(sma50_s, sma200_s, within=20)

    highs = swing_points(df["high"], "high")
    lows = swing_points(df["low"], "low")
    higher_highs = len(highs) >= 3 and highs[-1] > highs[-2] > highs[-3]
    lower_lows = len(lows) >= 3 and lows[-1] < lows[-2] < lows[-3]

    trend = SymbolTrend(
        price=price,
        sma_20=sma20,
        sma_50=sma50,
        sma_200=sma200,
        above_sma_20=None if sma20 is None else price > sma20,
        above_sma_50=None if sma50 is None else price > sma50,
        above_sma_200=None if sma200 is None else price > sma200,
        golden_cross_recent=golden,
        death_cross_recent=death,
        higher_highs=higher_highs,
        lower_lows=lower_lows,
    )

    rsi14 = rsi(closes, 14)
    macd_h, macd_slope = macd_hist_and_slope(closes)
    hi_52 = float(closes.tail(252).max()) if len(closes) >= 20 else float(closes.max())
    lo_52 = float(closes.tail(252).min()) if len(closes) >= 20 else float(closes.min())
    momentum = SymbolMomentum(
        rsi_14=rsi14,
        macd_hist=macd_h,
        macd_hist_slope_5=macd_slope,
        roc_20=roc(closes, 20),
        distance_from_52w_high_pct=(price / hi_52 - 1) if hi_52 else None,
        distance_from_52w_low_pct=(price / lo_52 - 1) if lo_52 else None,
    )

    mid, upper, lower, pct_b, bandwidth = bollinger(closes, 20, 2)
    rvol = realized_vol_annualized(closes, cfg.short_days)
    volatility = SymbolVolatility(
        realized_vol_20d_annualized=rvol,
        atr_14=atr(df, 14),
        bollinger_pct_b=pct_b,
        bollinger_bandwidth=bandwidth,
        parkinson_vol=parkinson_vol(df, cfg.short_days),
    )

    vol_ratio = volume_ratio(df["volume"], cfg.short_days)
    volume = SymbolVolume(
        volume_ratio_20d=vol_ratio,
        obv_slope_20=obv_slope(closes, df["volume"], cfg.short_days),
    )

    support = lows[-1] if lows else (lower if lower else None)
    resistance = highs[-1] if highs else (upper if upper else None)
    levels = SymbolLevels(
        recent_swing_highs=highs,
        recent_swing_lows=lows,
        nearest_support=support,
        nearest_resistance=resistance,
        distance_upper_band_pct=((upper - price) / price) if upper else None,
        distance_lower_band_pct=((price - lower) / price) if lower else None,
    )

    relative = SymbolRelative()
    if not bench.empty and len(bench) >= cfg.min_history_days_for_beta:
        bclose = bench["close"]
        # Align on overlapping dates
        joined = pd.concat([closes.rename("a"), bclose.rename("b")], axis=1).dropna()
        if len(joined) >= cfg.min_history_days_for_beta:
            relative = SymbolRelative(
                beta_vs_primary_60d=beta_vs(joined["a"], joined["b"], cfg.medium_days),
                correlation_vs_primary=correlation_vs(joined["a"], joined["b"], cfg.medium_days),
                excess_return_1m=(
                    None
                    if period_return(joined["a"], 21) is None or period_return(joined["b"], 21) is None
                    else period_return(joined["a"], 21) - period_return(joined["b"], 21)
                ),
                excess_return_3m=(
                    None
                    if period_return(joined["a"], 63) is None or period_return(joined["b"], 63) is None
                    else period_return(joined["a"], 63) - period_return(joined["b"], 63)
                ),
            )
            quality.relative = DataQuality.OK
        else:
            quality.relative = DataQuality.PARTIAL
    else:
        quality.relative = DataQuality.MISSING

    qfields = SymbolQuality(
        pe=fundamentals.get("pe"),
        gross_margin=fundamentals.get("gross_margin"),
        operating_margin=fundamentals.get("operating_margin"),
        debt_to_equity=fundamentals.get("debt_to_equity"),
        revenue_growth_yoy=fundamentals.get("revenue_growth_yoy"),
    )
    quality.quality = (
        DataQuality.OK
        if any(v is not None for v in qfields.model_dump().values())
        else DataQuality.MISSING
    )

    event = SymbolEvent(
        days_to_next_earnings=earnings.get("days_to_next_earnings"),
        last_4_earnings_surprise_pct=earnings.get("last_4_earnings_surprise_pct") or [],
    )

    trend_signal = sum(
        [
            0.4 if trend.above_sma_20 else 0.0,
            0.3 if trend.above_sma_50 else 0.0,
            0.3 if trend.above_sma_200 else 0.0,
        ]
    )
    if trend.golden_cross_recent:
        trend_signal = min(1.0, trend_signal + 0.1)
    if trend.death_cross_recent:
        trend_signal = max(0.0, trend_signal - 0.2)

    score = _score_from_parts(
        cfg,
        trend_signal,
        rsi14,
        rvol,
        vol_ratio,
        relative.excess_return_1m,
        event.days_to_next_earnings,
        quality_signal=_quality_score(fundamentals),
    )

    if len(df) < 60:
        quality.trend = DataQuality.PARTIAL
        quality.momentum = DataQuality.PARTIAL
    if len(df) < 200:
        quality.trend = DataQuality.PARTIAL if quality.trend != DataQuality.MISSING else quality.trend

    ta_latest = compute_ta_latest(df)
    extras = SymbolExtras(**{k: ta_latest.get(k) for k in SymbolExtras.model_fields})

    if is_crypto_symbol(sym):
        # Fundamentals / earnings do not apply — don't flag as "missing history"
        quality.quality = DataQuality.PARTIAL
        quality.event = DataQuality.PARTIAL

    return SymbolQuantSnapshot(
        symbol=sym,
        computed_at=datetime.now(timezone.utc).isoformat(),
        returns=returns,
        trend=trend,
        momentum=momentum,
        volatility=volatility,
        volume=volume,
        levels=levels,
        relative=relative,
        quality=qfields,
        event=event,
        score=score,
        data_quality=quality,
        extras=extras,
    )
