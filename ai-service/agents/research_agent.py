import os
from models.schemas import ResearchRequest, ResearchResponse, Signal, Source
from tools.market_tools import fetch_quote, fetch_company_news

try:
    import google.generativeai as genai

    if os.getenv("GEMINI_API_KEY"):
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
except ImportError:
    genai = None


def _fallback_report(symbol: str, query: str, quote: dict, news: list) -> ResearchResponse:
    price = quote.get("c")
    change = quote.get("dp")
    headlines = [n.get("headline", "") for n in news[:3] if n.get("headline")]

    summary_parts = [f"Research request: {query}", f"{symbol} current price: ${price:.2f}." if price else f"{symbol} price unavailable."]
    if change is not None:
        summary_parts.append(f"Daily change: {change:+.2f}%.")
    if headlines:
        summary_parts.append("Recent headlines: " + "; ".join(headlines))

    signals = []
    if change is not None:
        if change > 1:
            signals.append(Signal(label="Bullish momentum", type="bullish"))
        elif change < -1:
            signals.append(Signal(label="Bearish momentum", type="bearish"))
        else:
            signals.append(Signal(label="Neutral momentum", type="neutral"))
    if abs(change or 0) > 3:
        signals.append(Signal(label="High volatility", type="warning"))

    sources = [
        Source(title=h, url=n.get("url"), type="news")
        for n, h in zip(news[:5], headlines)
        if h
    ]
    sources.insert(0, Source(title="Finnhub market quote", type="market"))

    return ResearchResponse(
        symbol=symbol,
        summary=" ".join(summary_parts),
        confidence=0.72,
        signals=signals or [Signal(label="Insufficient data", type="neutral")],
        sources=sources,
    )


async def _gemini_report(symbol: str, query: str, quote: dict, news: list) -> ResearchResponse:
    model = genai.GenerativeModel("gemini-2.0-flash")
    headlines = "\n".join(f"- {n.get('headline')}" for n in news[:6] if n.get("headline"))
    prompt = f"""You are a financial research analyst. Answer the user query about {symbol}.
Query: {query}
Quote: {quote}
Recent news:
{headlines}

Respond in 3-4 sentences. Be specific. Mention risks."""
    response = model.generate_content(prompt)
    text = response.text or "Unable to generate analysis."

    return ResearchResponse(
        symbol=symbol,
        summary=text,
        confidence=0.85,
        signals=[
            Signal(label="AI analysis available", type="neutral"),
        ],
        sources=[Source(title=n.get("headline", "News"), url=n.get("url"), type="news") for n in news[:3]],
    )


async def run_research_agent(req: ResearchRequest) -> ResearchResponse:
    symbol = req.symbol.upper()
    quote, news = await fetch_quote(symbol), await fetch_company_news(symbol)

    if genai and os.getenv("GEMINI_API_KEY"):
        try:
            return await _gemini_report(symbol, req.query, quote, news)
        except Exception:
            pass

    return _fallback_report(symbol, req.query, quote, news)
