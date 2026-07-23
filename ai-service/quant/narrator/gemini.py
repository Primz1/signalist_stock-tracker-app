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
    vals = list(snap.data_quality.model_dump().values())
    ok = sum(1 for v in vals if v == "ok")
    partial = sum(1 for v in vals if v == "partial")
    missing = sum(1 for v in vals if v == "missing")
    total = max(1, len(vals))
    score = (ok * 1.0 + partial * 0.5) / total
    if missing >= 4:
        score *= 0.7
    return round(score * 100, 1)


def _fallback_research(snap: SymbolQuantSnapshot, query: str) -> ResearchNarrative:
    t = snap.trend
    m = snap.momentum
    r = snap.returns
    bits = [
        f"{snap.symbol} last {t.price:.2f}.",
        f"1M return {r.r_1m * 100:.1f}%." if r.r_1m is not None else "1M return insufficient data.",
        f"RSI14 {m.rsi_14:.1f}." if m.rsi_14 is not None else "RSI insufficient data.",
        f"Score {snap.score.total}/100.",
    ]
    signals: list[str] = []
    if m.rsi_14 is not None and m.rsi_14 > 70:
        signals.append("warning")
    elif t.above_sma_50:
        signals.append("bullish")
    else:
        signals.append("neutral")
    return ResearchNarrative(
        summary=" ".join(bits) + f" Query: {query}",
        trend_read=f"Price vs SMA20/50/200: {t.above_sma_20}/{t.above_sma_50}/{t.above_sma_200}.",
        momentum_read=f"RSI {m.rsi_14}, MACD hist {m.macd_hist}." if m.rsi_14 is not None else "insufficient data",
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
            if snap.relative.beta_vs_primary_60d is not None and snap.relative.excess_return_1m is not None
            else "insufficient data"
        ),
        quality_read="insufficient data" if snap.data_quality.quality == "missing" else "Fundamentals available.",
        event_read=(
            f"Days to earnings: {snap.event.days_to_next_earnings}."
            if snap.event.days_to_next_earnings is not None
            else "insufficient data"
        ),
        confidence=_confidence_from_quality(snap),
        signals=signals,
        caveats="Deterministic fallback — Gemini unavailable or failed validation.",
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
3. Never invent levels, RSI, beta, or returns.
4. Never give a personal trading recommendation; describe what the numbers suggest.
5. Respond ONLY with JSON matching the schema.

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
