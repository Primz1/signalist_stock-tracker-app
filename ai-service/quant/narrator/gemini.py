from __future__ import annotations

import json
import os
import re
from typing import Any

from pydantic import BaseModel

from quant.types import (
    PortfolioQuantSnapshot,
    ResearchNarrative,
    ReviewNarrative,
    SymbolQuantSnapshot,
)

try:
    import google.generativeai as genai

    if os.getenv("GEMINI_API_KEY"):
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
except ImportError:
    genai = None


def extract_numbers_from_prose(text: str) -> list[str]:
    return re.findall(r"[-−]?\$?\d+\.?\d*%?", text or "")


def verify_narration_against_snapshot(narration_text: str, snapshot: BaseModel) -> tuple[bool, list[str]]:
    snapshot_norm = re.sub(r"[$%,\s−]", "", snapshot.model_dump_json().lower())
    uncited: list[str] = []
    for num in extract_numbers_from_prose(narration_text):
        normalized = re.sub(r"[$%,\s−]", "", num.lower().replace("−", "-").lstrip("-"))
        if not normalized or normalized == ".":
            continue
        # Allow small integers like 1-3 that often appear in prose structure
        if normalized.isdigit() and int(normalized) <= 5:
            continue
        if normalized not in snapshot_norm:
            uncited.append(num)
    return len(uncited) == 0, uncited


def _confidence_from_quality(snap: SymbolQuantSnapshot) -> float:
    """Blend data completeness with score conviction (not a hard-coded 100).

    Completeness alone saturates near 100 for liquid names whose buckets default
    to OK — pair it with how decisive the composite score is so the meter moves.
    """
    vals = list(snap.data_quality.model_dump().values())
    ok = sum(1 for v in vals if v == "ok")
    partial = sum(1 for v in vals if v == "partial")
    missing = sum(1 for v in vals if v == "missing")
    total = max(1, len(vals))
    completeness = (ok * 1.0 + partial * 0.5) / total
    if missing >= 4:
        completeness *= 0.7

    # 0 at score=50 (indecisive), 1 at 0 or 100
    conviction = abs(float(snap.score.total) - 50.0) / 50.0

    comps = snap.score.components or {}
    factor_vals = [
        float(comps[k])
        for k in ("trend", "momentum", "volatility_inv", "relative", "quality")
        if k in comps and isinstance(comps[k], (int, float))
    ]
    if len(factor_vals) >= 2:
        mean = sum(factor_vals) / len(factor_vals)
        var = sum((v - mean) ** 2 for v in factor_vals) / len(factor_vals)
        # High disagreement across factors → lower confidence
        agreement = max(0.0, 1.0 - (var ** 0.5) * 2.5)
    else:
        agreement = 0.5

    blended = completeness * 0.35 + conviction * 0.45 + agreement * 0.20
    return round(max(5.0, min(95.0, blended * 100)), 1)


def _is_crypto(sym: str) -> bool:
    s = (sym or "").upper()
    return bool(re.search(r"(USDT|USDC|USD|BTC|ETH|BNB)$", s)) and len(s) >= 5


def _fallback_research(snap: SymbolQuantSnapshot, query: str) -> ResearchNarrative:
    t = snap.trend
    m = snap.momentum
    r = snap.returns
    crypto = _is_crypto(snap.symbol)
    has_price = t.price is not None and float(t.price) > 0
    has_ohlcv = has_price and (
        t.above_sma_20 is not None or m.rsi_14 is not None or r.r_1m is not None
    )

    bits = [f"{snap.symbol} last {t.price:.2f}." if has_price else f"{snap.symbol}."]
    if r.r_1m is not None:
        bits.append(f"1M return {r.r_1m * 100:.1f}%.")
    elif has_ohlcv:
        bits.append("1M return not available.")
    if m.rsi_14 is not None:
        bits.append(f"RSI14 {m.rsi_14:.1f}.")
    bits.append(f"Score {snap.score.total}/100.")
    if crypto:
        bits.append("Crypto pair - price/trend factors only (no PE or earnings).")

    signals: list[str] = []
    if m.rsi_14 is not None and m.rsi_14 > 70:
        signals.append("warning")
    elif t.above_sma_50:
        signals.append("bullish")
    elif t.above_sma_20 is False:
        signals.append("bearish")
    else:
        signals.append("neutral")

    bull: list[str] = []
    bear: list[str] = []

    if has_ohlcv:
        if t.above_sma_20:
            bull.append("Holding above the 20-day moving average.")
        elif t.above_sma_20 is False:
            bear.append("Trading below the 20-day moving average.")

        if t.above_sma_50:
            bull.append("Price remains above the 50-day trend average.")
        elif t.above_sma_50 is False:
            bear.append("Price is under the 50-day trend average.")

        if t.above_sma_200:
            bull.append("Still above the 200-day average (longer-term uptrend intact).")
        elif t.above_sma_200 is False:
            bear.append("Trading below the 200-day average (longer-term pressure).")

        if m.rsi_14 is not None:
            if m.rsi_14 <= 30:
                bull.append(f"RSI washed out at {m.rsi_14:.0f} - oversold territory.")
            elif m.rsi_14 >= 70:
                bear.append(f"RSI elevated at {m.rsi_14:.0f} - stretched upside.")
            elif 40 <= m.rsi_14 <= 65:
                bull.append(f"RSI near neutral territory ({m.rsi_14:.0f}).")
            elif m.rsi_14 > 55:
                bull.append(f"RSI shows mild upside bias ({m.rsi_14:.0f}).")
            else:
                bear.append(f"RSI shows mild downside bias ({m.rsi_14:.0f}).")

        if m.macd_hist is not None and m.macd_hist > 0:
            bull.append("MACD histogram is positive.")
        elif m.macd_hist is not None and m.macd_hist < 0:
            bear.append("MACD histogram is negative.")

        if r.r_1m is not None and r.r_1m > 0.05:
            bull.append(f"Solid 1-month return ({r.r_1m * 100:.1f}%).")
        elif r.r_1m is not None and r.r_1m < -0.05:
            bear.append(f"Weak 1-month return ({r.r_1m * 100:.1f}%).")

        if snap.levels.nearest_resistance is not None:
            bear.append(f"Nearby resistance around {snap.levels.nearest_resistance:.0f}.")
        if snap.levels.nearest_support is not None:
            bull.append(f"Nearby support around {snap.levels.nearest_support:.0f}.")

        if (
            not crypto
            and snap.event.days_to_next_earnings is not None
            and snap.event.days_to_next_earnings < 21
        ):
            bear.append("Upcoming earnings may add short-term volatility.")
    else:
        bear.append("Not enough daily price history to build a clear technical case.")

    catalysts: list[dict[str, str]] = []
    if not crypto and snap.event.days_to_next_earnings is not None:
        catalysts.append(
            {
                "when": f"in {snap.event.days_to_next_earnings}d",
                "label": "Next earnings window",
            }
        )

    quality_read = (
        "N/A for crypto — no PE/margins."
        if crypto
        else (
            "insufficient data"
            if snap.data_quality.quality == "missing"
            else "Fundamentals available."
        )
    )
    event_read = (
        "N/A for crypto — no earnings calendar."
        if crypto
        else (
            f"Days to earnings: {snap.event.days_to_next_earnings}."
            if snap.event.days_to_next_earnings is not None
            else "insufficient data"
        )
    )

    return ResearchNarrative(
        summary=" ".join(bits) + f" Query: {query}",
        trend_read=(
            f"Price vs SMA20/50/200: {t.above_sma_20}/{t.above_sma_50}/{t.above_sma_200}."
            if has_ohlcv
            else "insufficient data"
        ),
        momentum_read=(
            f"RSI {m.rsi_14}, MACD hist {m.macd_hist}."
            if m.rsi_14 is not None
            else "insufficient data"
        ),
        volatility_read=(
            f"Realized vol {snap.volatility.realized_vol_20d_annualized * 100:.1f}%."
            if snap.volatility.realized_vol_20d_annualized is not None
            else "insufficient data"
        ),
        levels_read=(
            f"Support {snap.levels.nearest_support}, resistance {snap.levels.nearest_resistance}."
            if snap.levels.nearest_support is not None
            else "insufficient data"
        ),
        relative_read=(
            f"Beta {snap.relative.beta_vs_primary_60d:.2f}, excess 1M {snap.relative.excess_return_1m * 100:.1f}%."
            if snap.relative.beta_vs_primary_60d is not None
            and snap.relative.excess_return_1m is not None
            else ("N/A vs equity benchmark for crypto." if crypto else "insufficient data")
        ),
        quality_read=quality_read,
        event_read=event_read,
        confidence=_confidence_from_quality(snap),
        signals=signals,
        caveats="Deterministic fallback — Gemini unavailable or failed validation.",
        bull_case=bull[:4]
        or (["Price data loaded but no clear bullish technicals."] if has_ohlcv else ["Need more price history for a bull case."]),
        bear_case=bear[:4]
        or (["Price data loaded but no clear bearish technicals."] if has_ohlcv else ["Need more price history for a bear case."]),
        catalysts=catalysts,
    )


async def narrate_research(
    snap: SymbolQuantSnapshot,
    query: str,
    news: list[dict[str, Any]] | None = None,
) -> ResearchNarrative:
    news = news or []
    if not (genai and os.getenv("GEMINI_API_KEY")):
        return _fallback_research(snap, query)

    headlines = "\n".join(f"- {n.get('headline')}" for n in news[:6] if n.get("headline"))
    prompt = f"""You are Signalist's research analyst. You have a computed quant snapshot for {snap.symbol}.
RULES:
1. Every number you cite MUST appear in the SNAPSHOT JSON.
2. If a field is null or data_quality is missing, write "insufficient data" for that bucket.
3. For crypto symbols (*USDT/*USDC or similar), quality and event are N/A — say "N/A for crypto" instead of "insufficient data".
4. Never invent levels, RSI, beta, or returns.
5. Never give a personal trading recommendation; describe what the numbers suggest. You may say the setup "leans buy/sell/wait" based on the score.
6. Always include 2-4 concrete bull_case and bear_case bullets grounded in snapshot fields when price history exists.
7. Respond ONLY with JSON matching the schema.

USER QUERY: {query}
SNAPSHOT: {snap.model_dump_json()}
RECENT NEWS (context only):
{headlines}

SCHEMA:
{{
  "summary": "string",
  "trend_read": "string",
  "momentum_read": "string",
  "volatility_read": "string",
  "levels_read": "string",
  "relative_read": "string",
  "quality_read": "string",
  "event_read": "string",
  "confidence": 0-100,
  "signals": ["bullish"|"bearish"|"warning"|"neutral"],
  "caveats": "string",
  "bull_case": ["2-4 short bullets grounded in snapshot numbers"],
  "bear_case": ["2-4 short bullets grounded in snapshot numbers"],
  "catalysts": [{{"when": "Mar 28", "label": "Earnings call"}}]
}}
"""
    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        text = (response.text or "").strip()
        if text.startswith("```"):
            text = text.strip("`")
            text = text.replace("json", "", 1).strip()
        data = json.loads(text)
        data["confidence"] = _confidence_from_quality(snap)
        narrative = ResearchNarrative.model_validate(data)
        blob = " ".join(
            [
                narrative.summary,
                narrative.trend_read,
                narrative.momentum_read,
                narrative.volatility_read,
                narrative.levels_read,
                narrative.relative_read,
            ]
        )
        ok, _ = verify_narration_against_snapshot(blob, snap)
        if not ok:
            narrative.caveats = (narrative.caveats + " Some figures could not be fully verified against snapshot.").strip()
        return narrative
    except Exception:
        return _fallback_research(snap, query)


def _fallback_review(snap: PortfolioQuantSnapshot) -> ReviewNarrative:
    rules = "; ".join(r.message for r in snap.rules_fired[:3]) or "No rules fired."
    return ReviewNarrative(
        summary=(
            f"NAV {snap.nav:.2f} with cash {snap.cash_pct * 100:.1f}%. "
            f"HHI {snap.concentration.hhi:.2f}, effective N {snap.concentration.effective_n:.1f}. {rules}"
        ),
        concentration_read=(
            f"Top-1 {snap.concentration.top_1_symbol} at {snap.concentration.top_1_weight * 100:.1f}%."
        ),
        risk_read=(
            f"Weighted vol {snap.risk.weighted_vol_20d}."
            if snap.risk.weighted_vol_20d is not None
            else "insufficient data"
        ),
        attribution_read=f"{len(snap.pl_attribution.winners)} winners / {len(snap.pl_attribution.losers)} losers.",
        drawdown_read=(
            f"Max DD {snap.drawdown.max_dd * 100:.1f}%, current {snap.drawdown.current_dd * 100:.1f}%."
            if snap.drawdown.max_dd is not None and snap.drawdown.current_dd is not None
            else "insufficient data"
        ),
        actions_read=rules,
        confidence=70.0 if snap.holdings else 40.0,
        caveats="Deterministic fallback review.",
    )


async def narrate_review(
    snap: PortfolioQuantSnapshot,
    symbol_snaps: dict[str, SymbolQuantSnapshot],
) -> ReviewNarrative:
    if not (genai and os.getenv("GEMINI_API_KEY")):
        return _fallback_review(snap)

    prompt = f"""You are Signalist's portfolio reviewer. Narrate the portfolio quant snapshot.
RULES:
1. Cite only numbers present in SNAPSHOT.
2. Treat rules_fired as observations ("Signalist noticed…"), not orders.
3. Respond ONLY with JSON.

SNAPSHOT: {snap.model_dump_json()}
PER_SYMBOL_SCORES: {json.dumps({k: v.score.total for k, v in symbol_snaps.items()})}

SCHEMA:
{{
  "summary": "string",
  "concentration_read": "string",
  "risk_read": "string",
  "attribution_read": "string",
  "drawdown_read": "string",
  "actions_read": "string",
  "confidence": 0-100,
  "caveats": "string"
}}
"""
    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        text = (response.text or "").strip()
        if text.startswith("```"):
            text = text.strip("`")
            text = text.replace("json", "", 1).strip()
        narrative = ReviewNarrative.model_validate(json.loads(text))
        ok, _ = verify_narration_against_snapshot(narrative.summary + narrative.concentration_read, snap)
        if not ok:
            narrative.caveats = (narrative.caveats + " Verification soft-fail on cited numbers.").strip()
        return narrative
    except Exception:
        return _fallback_review(snap)
