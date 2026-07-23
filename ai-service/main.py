import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Load repo-root .env so FINNHUB / GEMINI work when started from ai-service/
_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / ".env")
load_dotenv(Path(__file__).resolve().parent / ".env")

from models.schemas import ResearchRequest, ResearchResponse, Signal, Source
from tools.market_tools import fetch_company_news
from quant.composites.portfolio_snapshot import build_portfolio_snapshot
from quant.composites.symbol_snapshot import build_symbol_snapshot
from quant.narrator.gemini import narrate_research, narrate_review

app = FastAPI(title="Signalist AI Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _verify_secret(x_internal_secret: str | None) -> None:
    expected = os.getenv("INTERNAL_API_SECRET")
    if expected and x_internal_secret != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


class PortfolioReviewRequest(BaseModel):
    cash: float = 0
    holdings: list[dict] = Field(default_factory=list)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "signalist-ai",
        "quant": True,
        "gemini": bool(os.getenv("GEMINI_API_KEY")),
        "finnhub": bool(os.getenv("FINNHUB_API_KEY") or os.getenv("NEXT_PUBLIC_FINNHUB_API_KEY")),
    }


@app.get("/quant/symbol/{symbol}")
async def quant_symbol(symbol: str, x_internal_secret: str | None = Header(default=None)):
    _verify_secret(x_internal_secret)
    snap = await build_symbol_snapshot(symbol)
    return snap.model_dump()


@app.post("/quant/portfolio")
async def quant_portfolio(
    payload: PortfolioReviewRequest,
    x_internal_secret: str | None = Header(default=None),
):
    _verify_secret(x_internal_secret)
    snap, _ = await build_portfolio_snapshot(payload.cash, payload.holdings)
    return snap.model_dump()


@app.post("/agent/research", response_model=ResearchResponse)
async def research(req: ResearchRequest, x_internal_secret: str | None = Header(default=None)):
    _verify_secret(x_internal_secret)
    symbol = req.symbol.upper()
    snap = await build_symbol_snapshot(symbol)
    news = await fetch_company_news(symbol)
    narrative = await narrate_research(snap, req.query, news)

    signal_map = {"bullish": "bullish", "bearish": "bearish", "warning": "warning", "neutral": "neutral"}
    signals = [
        Signal(label=s if len(s) > 12 else s.title() + " signal", type=signal_map.get(s, "neutral"))
        for s in (narrative.signals or ["neutral"])[:3]
    ]
    sources = [
        Source(title=n.get("headline", "News"), url=n.get("url"), type="news")
        for n in news[:5]
        if n.get("headline")
    ]
    sources.insert(0, Source(title="Signalist quant snapshot", type="indicator"))

    summary_parts = [
        narrative.summary,
        narrative.trend_read,
        narrative.momentum_read,
        narrative.caveats,
    ]
    summary = " ".join(p for p in summary_parts if p).strip()

    return ResearchResponse(
        symbol=symbol,
        summary=summary,
        confidence=max(0.0, min(1.0, float(narrative.confidence) / 100.0)),
        signals=signals,
        sources=sources,
        # Extra fields ignored by ResearchResponse — attach via custom response below if needed
    )


@app.post("/agent/research/full")
async def research_full(req: ResearchRequest, x_internal_secret: str | None = Header(default=None)):
    """Quant snapshot + structured narrative for richer UI."""
    _verify_secret(x_internal_secret)
    symbol = req.symbol.upper()
    snap = await build_symbol_snapshot(symbol)
    news = await fetch_company_news(symbol)
    narrative = await narrate_research(snap, req.query, news)
    return {
        "symbol": symbol,
        "snapshot": snap.model_dump(),
        "narrative": narrative.model_dump(),
        "news": [{"headline": n.get("headline"), "url": n.get("url")} for n in news[:8]],
        "confidence": max(0.0, min(1.0, float(narrative.confidence) / 100.0)),
        "summary": narrative.summary,
        "signals": [{"label": s, "type": s} for s in narrative.signals],
        "sources": [
            {"title": n.get("headline", "News"), "url": n.get("url"), "type": "news"}
            for n in news[:5]
            if n.get("headline")
        ],
    }


@app.post("/agent/portfolio-review")
async def portfolio_review(
    payload: PortfolioReviewRequest,
    x_internal_secret: str | None = Header(default=None),
):
    _verify_secret(x_internal_secret)
    snap, symbol_snaps = await build_portfolio_snapshot(payload.cash, payload.holdings)
    narrative = await narrate_review(snap, symbol_snaps)
    return {
        "summary": narrative.summary,
        "confidence": max(0.0, min(1.0, float(narrative.confidence) / 100.0)),
        "narrative": narrative.model_dump(),
        "snapshot": snap.model_dump(),
        "rules_fired": [r.model_dump() for r in snap.rules_fired],
    }
