# Signalist — Market Intelligence Platform

A full-stack financial intelligence platform: custom charting with technical indicators, AI research agent, paper portfolio, multi-factor stock scoring, event-driven alerts, and a public developer API.

**Stack:** Next.js 15 · MongoDB · Better Auth · Inngest · FastAPI · Lightweight Charts · Gemini

---

## Platform features

| Feature | Description |
|---------|-------------|
| **Custom charts** | Candlestick + volume + SMA on `/stocks/[symbol]` (Lightweight Charts) |
| **Technical indicators** | RSI, MACD, Bollinger Bands, signal badges |
| **AI Research Agent** | Chat UI at `/research` — FastAPI + Gemini with cited sources |
| **Paper portfolio** | $10K virtual cash, buy/sell, P/L, allocation chart at `/portfolio` |
| **AI stock scoring** | Multi-factor score (technical, news, momentum, risk, earnings) on watchlist |
| **Event pipeline** | Inngest price poller → Redis Streams → alert consumers + SSE |
| **Public API** | `GET /api/v1/stocks/:symbol` with API keys at `/developers` |
| **Observability** | Sentry (optional), PostHog (optional), structured JSON logs |
| **CI/CD** | GitHub Actions: lint → typecheck → build → Vitest → pytest |

---

## Architecture

```mermaid
flowchart TB
    subgraph nextjs [Next.js on Vercel]
        UI[Dashboard Charts Research Portfolio]
        APIv1[Public API v1]
        SSE[SSE /api/stream/prices]
        InngestHandler[/api/inngest]
    end

    subgraph fastapi [FastAPI ai-service]
        Agent[Research Agent]
        PortfolioAI[Portfolio Review]
    end

    subgraph data [Data]
        Mongo[(MongoDB)]
        Redis[(Upstash Redis)]
    end

    UI --> Agent
    APIv1 --> Mongo
    InngestHandler --> Mongo
    InngestHandler --> Redis
    Agent --> Mongo
```

---

## New routes

| Route | Purpose |
|-------|---------|
| `/stocks/[symbol]` | Custom chart + indicators + AI summary |
| `/research` | AI research agent chat |
| `/portfolio` | Paper trading simulator |
| `/developers` | API key management |
| `/settings` | Investment profile |
| `/api/v1/stocks/:symbol` | Public stock data API |
| `/api/stream/prices` | SSE price events |

---

## Environment variables

```env
# Core
MONGODB_URI=
BETTER_AUTH_URL=
BETTER_AUTH_SECRET=
FINNHUB_API_KEY=

# Email
NODEMAILER_EMAIL=
NODEMAILER_PASSWORD=
GEMINI_API_KEY=

# AI service (hybrid)
FASTAPI_URL=http://localhost:8000
INTERNAL_API_SECRET=your-shared-secret

# Optional
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
```

---

## Local development

```bash
# Next.js
npm install
npm run dev

# AI service (separate terminal)
npm run ai:dev
# or: cd ai-service && uvicorn main:app --reload --port 8000

# Tests
npm run test          # Vitest (indicators)
npm run test:e2e      # Playwright smoke test
```

---

## MongoDB collections

| Collection | Purpose |
|------------|---------|
| `user`, `session`, `account`, `verification` | Better Auth |
| `watchlists`, `alerts`, `alertnotifications` | Core app |
| `userprofiles` | Investment preferences |
| `marketsnapshots` | OHLCV + indicators cache |
| `aireports` | AI research reports |
| `events` | Event log |
| `portfolios`, `portfoliotrades` | Paper trading |
| `stockscores` | Multi-factor scores |
| `apikeys` | Developer API keys |

---

## Resume narrative

> Built Signalist, a market intelligence platform with custom financial charting (RSI, MACD, Bollinger), a hybrid AI research agent (FastAPI + Gemini), event-driven price pipeline (Inngest + Redis), paper portfolio simulator, multi-factor stock scoring, public REST API, and production CI/CD with Vitest and Playwright.

---

## Demo script (2 min)

1. **Dashboard** — market overview widgets
2. **Stock page** — custom chart, indicators, signal badges, AI score
3. **Research** — "Should I watch NVDA?" → cited AI report
4. **Watchlist** — AI scores per symbol, create alert
5. **Portfolio** — paper trade + AI allocation review
6. **Developers** — generate API key, call `/api/v1/stocks/AAPL`
