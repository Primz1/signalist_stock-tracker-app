# Signalist build status

Living record of the product build. Last updated 2026-11-03 on branch `signalist-v4`.

## Current verdict

Production's background pipeline now runs. Polling, alerts, snapshots and scores write real data,
and the AI service stays up when Gemini misbehaves. Milestone 2 (normalized models and one market
data service) is built and tested on `signalist-v4` but not deployed.

Baseline audit, 2026-11-02 (read-only):

| Check | Result |
| --- | --- |
| `GET signalist-blue.vercel.app/api/inngest` | 401. Vercel logs: `No signing key found in client options or INNGEST_SIGNING_KEY` |
| Atlas collection counts | `marketsnapshots` 0, `stockscores` 0, `appevents` 1. No job had ever run |
| `GET /api/auth/get-session` | 200 `null`, so auth and Mongo worked |
| Render routes | No `/agent/whats-changed`: deployed from `main`, 10 commits behind |
| `tsc`, `vitest`, `eslint` | Pass, 30 of 30, 59 errors all in untracked `.agents/` |

## What already works

- Landing page, better-auth with email verification, session middleware
- Watchlist CRUD, price alert CRUD, `once`/`per_hour`/`per_day` frequency handling
- Stock pages: candlestick chart, RSI, MACD, Bollinger, SMA
- Paper portfolio: $10,000 balance, trades, realized P/L, undo
- AI research through FastAPI: deterministic quant snapshot, Gemini narration, numeric check, fallback copy
- Signals page: SSE stream with polling fallback, timeline, per-symbol filter, heatmap
- Developer API keys: SHA-256 hashed, shown once
- Cmd/Ctrl+K search

## Partially implemented

- **Signals**: five single-reading detectors. Each fires its own card, nothing correlates them, and there is no strength, confidence or lifecycle. Replaced in Milestone 3.
- **Snapshots**: every 15 minutes, watchlist symbols only, each embedding 60 daily candles. Replaced in Milestone 3.
- **Developer API**: two endpoints under `/api/v1/stocks`, no rate limit enforcement (`rateLimit` is stored and ignored), no revocation, keys accepted in the query string.
- **Stock score**: `computeStockScore` hard-codes `earnings = 15` and scores news by article count. Replaced by deterministic signal scoring.

## Broken or risky, with status

| # | Issue | Status |
| --- | --- | --- |
| 1 | Inngest never ran in production | Fixed and verified 2026-11-03 |
| 2 | Two Inngest functions evaluated every alert | Fixed, deployed |
| 3 | `isCryptoSymbol` differed across files | Fixed in Milestone 2: one rule in `lib/market/symbols.ts` |
| 4 | Yahoo v7 quote endpoint fails for servers | Fixed in Milestone 2: quotes read the v8 chart endpoint |
| 5 | Stock quotes had no fallback provider | Fixed in Milestone 2: Finnhub then Yahoo, verified live during a Finnhub 502 |
| 6 | FastAPI calls had no timeout | Fixed, deployed |
| 7 | "What changed" threw when AI was down | Fixed, deployed: deterministic fallback |
| 8 | No `SENTRY_DSN` in production | Open, needs the owner's Sentry DSN |
| 9 | Build needed a live database | Fixed, deployed |
| 10 | Dashboard and landing page showed other users' AI reports | Fixed, deployed |
| 11 | Blocking Gemini calls froze the AI service | Fixed, deployed `4c1a43a`. Render stayed healthy through 3 checks |
| 12 | Gemini on Render falls back instantly (0.2s, confidence 0.5), while the same code locally returns a validated summary in 1.5s | Open. Points to Render's `GEMINI_API_KEY` or a `GEMINI_MODEL` override. Needs Render dashboard access |
| 13 | Dashboard portfolio chart is drawn from `deterministicSeries`, a seeded fake series, not real history | Open, Milestone 6 |
| 14 | Landing page shows hard-coded prices (`FALLBACK`) when providers fail, without saying so | Open, Milestone 8 |
| 15 | Watchlist refresh called Finnhub from the browser with `NEXT_PUBLIC_FINNHUB_API_KEY` | Fixed in Milestone 2: `/api/quotes` server route. The public key can now be removed from Vercel |
| 16 | Binance candles returned the oldest 1,000 bars for long ranges | Fixed in Milestone 2, found by the live smoke test |

## Duplicated systems

- Quote fetching: resolved in Milestone 2. Everything goes through `MarketDataService`. News, search and company profile stay in `lib/actions/finnhub.actions.ts`, the one Finnhub reference-data module.
- Signal derivation: `lib/market/signals.ts`, `deriveSignals` in `lib/market/indicators`, `ai-service/quant/rules/engine.py`, `lib/scoring/computeScore.ts`. Consolidated in Milestone 3.
- Indicators: TypeScript `lib/market/indicators` and Python `ai-service/quant`. Product signals will use the TypeScript engine only. Python stays for the research tearsheet.

## Environment variables

| Variable | Status |
| --- | --- |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Set in production 2026-11-02 |
| `BETTER_AUTH_URL` | Correct in production (`signalist-blue.vercel.app`) |
| `SENTRY_DSN` | Missing |
| `NEXT_PUBLIC_POSTHOG_KEY` | Missing |
| `NEXT_PUBLIC_FINNHUB_API_KEY` | No longer read by any code after Milestone 2 deploys. Remove it, and rotate the Finnhub key because it was public |

## Dead code and repo noise

- `Stock trading app prototype*/`, `Signalist 21stdev ui prompts/`, `files/`, `family_playlist.py`, `people_birthdays.py`, `playlist.dat` are unrelated or superseded.
- `.claude/skills` is tracked (831 files). `.agents/` and `QuantAgent*` are untracked and excluded from lint.
- `ai-service/agents/research_agent.py` is not used by `main.py`. Only its test imports it.

None of this was removed. Deleting it needs the owner's sign-off.

## Architectural decisions

- **No persistent worker on Vercel.** Provider WebSockets can't be held open server-side. Live crypto can stream from Binance to the browser. Server data stays on polling.
- **Inngest quota.** Free plan is 50,000 executions a month and every step counts. Functions avoid per-symbol steps.
- **Finnhub free tier.** 60 calls a minute and no candles (403). Stock candles come from Yahoo, crypto from Binance. A 401 or 403 makes the service skip that provider capability for an hour.
- **Binance.** `api.binance.com` refuses US traffic. The service uses `data-api.binance.vision`.
- **Atlas M0 storage.** TTL indexes on snapshots (3 days), market events (30 days) and telemetry events.
- **Render free tier sleeps** after 15 minutes idle. AI calls have short timeouts and deterministic fallback.
- **Design.** The product spec (section 38) overrides the global `CLAUDE.md` style: extend the existing v3 editorial `--sg-*` tokens, no new glass or glow.

## Inngest budget

| Function | Schedule | Executions a month |
| --- | --- | --- |
| `poll-market-prices` | Every 2 minutes, no steps | 21,600 |
| `capture-market-snapshots` | Every 15 minutes, one event send when signals fire | Up to 5,760 |
| `check-price-alerts` | Removed, merged into the poller | 0 |

## Milestone 1: Stabilize

- [x] Inngest keys in production, app synced through `signalist-blue.vercel.app`
- [x] Deploy: `e2e686e` then `4c1a43a` on `main`
- [x] Render running current code with `ai_provider`
- [x] Price polling: 18 price events by 01:44 UTC
- [x] Alert processing: 2 alerts triggered at 01:34 UTC
- [x] Snapshots and scores: 9 each at 01:45 UTC, fresh again at 15:45 UTC
- [x] AI service survives Gemini outages (issue 11)
- [ ] Gemini summaries on Render (issue 12)
- [ ] Signal detection seen firing
- [ ] Daily digest: cron at 12:00 UTC. Confirm in Inngest Runs for `daily-news-summary`
- [ ] Welcome email after a verified signup
- [ ] Sentry receiving errors (issue 8)

## Milestone 2: Normalize

Built and tested on `signalist-v4`, not deployed.

- `lib/market/symbols.ts`: one set of symbol rules, including input validation
- `lib/market/providers/`: `FinnhubProvider`, `BinanceProvider`, `YahooProvider` behind one interface. Failures raise `ProviderError` with the HTTP status
- `lib/market/service.ts`: `MarketDataService` with fallback order per asset class, entitlement and rate-limit backoff, Binance batch quotes, in-flight de-duplication, provider health, and source plus fallback on every result
- All quote and candle callers moved onto it: alerts, poller, charts, portfolio, research header, watchlist, dashboard, landing page, API
- Models: `Asset`, `MarketEvent` (unique `dedupeKey`, 30-day TTL), `Signal` (strength and confidence separate, lifecycle, evidence, components, provenance), and `MarketSnapshot` extended with analytics and provenance fields
- `GET /api/quotes`: authenticated, validated, at most 50 symbols
- Tests: 53 pass, including provider parsing, fallback, backoff, batching, de-duplication and key handling
- Live smoke test against real vendors passed

## Milestones

| # | Milestone | Status |
| --- | --- | --- |
| 1 | Stabilize | Deployed. Open: Gemini on Render, digest, welcome email, Sentry |
| 2 | Normalize | Built and tested, not deployed |
| 3 | Intelligence engine | Not started |
| 4 | AI | Not started |
| 5 | Signals UX | Not started |
| 6 | Connect existing product | Not started |
| 7 | Developer platform | Not started |
| 8 | Hardening | Not started |
