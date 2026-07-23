import os
import httpx


FINNHUB_BASE = "https://finnhub.io/api/v1"


def _token() -> str:
    return os.getenv("FINNHUB_API_KEY", "")


async def fetch_quote(symbol: str) -> dict:
    token = _token()
    if not token:
        return {}
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(f"{FINNHUB_BASE}/quote", params={"symbol": symbol, "token": token})
        res.raise_for_status()
        return res.json()


async def fetch_company_news(symbol: str, days: int = 7) -> list[dict]:
    token = _token()
    if not token:
        return []
    from datetime import datetime, timedelta

    to_date = datetime.utcnow().date()
    from_date = to_date - timedelta(days=days)
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(
            f"{FINNHUB_BASE}/company-news",
            params={
                "symbol": symbol,
                "from": from_date.isoformat(),
                "to": to_date.isoformat(),
                "token": token,
            },
        )
        res.raise_for_status()
        data = res.json()
        return data if isinstance(data, list) else []
