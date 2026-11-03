# Signalist build status

Living record of the product build. Last updated 2026-11-02 on branch `signalist-v4`.

## Current verdict

**Production's intelligence pipeline has never run.** Pages render and auth works, but no background
job executes, so nothing downstream of market polling has real data.

Evidence gathered 2026-11-02 (read-only):

| Check | Result |
| --- | --- |
| `GET signalist-blue.vercel.app/api/inngest` | 401. Vercel logs: `No signing key found in client options or INNGEST_SIGNING_KEY` |
| Vercel production env | 11 vars. Missing `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `UPSTASH_*`, `NEXT_PUBLIC_POSTHOG_KEY` |
| Atlas collection counts | `marketsnapshots` 0, `stockscores` 0, `appevents` 1, `alerts` 9, `watchlists` 14, `user` 3 |
| `GET /api/auth/get-session` | 200 `null`, so auth and Mongo work in production |
| Render `signalist-ai.onrender.com/health` | 200 after a cold start (first probe timed out at 15s) |
| Render routes | No `/agent/whats-changed`: the service is deployed from `main`, 10 commits behind `signalist-v4` |
| Railway CLI/MCP | Not authenticated |
| `tsc --noEmit` | Pass |
| `vitest` | 30 of 30 pass |
| `eslint` | 59 errors, all in the untracked `.agents/` directory. 0 errors in app code |

## What already works

- Landing page, better-auth with email verification, session middleware
- Watchlist CRUD, price alert CRUD, `once`/`per_hour`/`per_day` frequency handling
- Stock pages: candlestick chart, RSI, MACD, Bollinger, SMA
- Paper portfolio: $10,000 balance, trades, realized P/L, undo
- AI research through FastAPI: deterministic quant snapshot, Gemini narration, numeric check, fallback copy
- Signals page: SSE stream with polling fallback, timeline, per-symbol filter, heatmap
- Developer API keys: SHA-256 hashed, shown once
- Cmd/Ctrl+K search, with Sentry and PostHog wired in code (both unset in production)

## Partially implemented

- **Signals**: five single-reading detectors. Each fires its own card, nothing correlates them, and there is no strength, confidence or lifecycle.
- **Snapshots**: every 15 minutes, watchlist symbols only, each embedding 60 candles. Daily candles are used, so "unusual move since last reading" compares readings of a mostly unchanged daily series.
- **Developer API**: two endpoints under `/api/v1/stocks`, no rate limit enforcement (`rateLimit` is stored and ignored), no revocation, keys accepted in the query string.
- **Stock score**: `computeStockScore` hard-codes `earnings = 15` and scores news by article count. It needs replacing by deterministic signal scoring.

## Broken

1. Inngest cron and events in production (above). Welcome email, daily digest, alerts, polling, snapshots and signals all depend on it.
2. Alert delivery duplicates: `check-price-alerts` (every 5 min) and the `evaluate-alerts` step in `poll-market-prices` (every minute) both evaluate alerts.
3. `isCryptoSymbol` differs between `lib/inngest/alert-check.ts` and `lib/market/ohlcv.ts`, so `BTCUSD` is crypto in one and a stock in the other.
4. `fetchYahooQuote` calls the v7 quote endpoint, which needs a crumb and fails for server clients.
5. `fetchQuoteBinance` fallback is unreachable when no Finnhub token exists only for non-crypto. Stock quotes have no Yahoo fallback in `fetchQuote`.
6. FastAPI calls have no timeout, so a Render cold start can hang a server action or Inngest step.
7. `createWhatsChangedReport` throws when AI is down, leaving no explanation at all instead of deterministic copy.
8. Sentry server DSN unset in production, so server errors are not reported.
9. Fixed: `lib/better-auth/auth.ts` connected to Mongo at import time and `(root)` pages were prerendered, so `next build` failed when the database was unreachable.
10. Fixed: privacy leak. The dashboard listed the latest AI reports of all users, and the public landing page showed the first 120 characters of any user's latest report. Both now exclude other users' reports.

## Duplicated systems

- Quote fetching: `lib/inngest/alert-check.ts`, `lib/market/ohlcv.ts`, `lib/actions/finnhub.actions.ts`, `lib/marketing/live-data.ts`, watchlist and dashboard pages.
- Signal derivation: `lib/market/signals.ts` (events), `deriveSignals` in `lib/market/indicators` (labels), `ai-service/quant/rules/engine.py` (rules), `lib/scoring/computeScore.ts` (score).
- Indicators: TypeScript `lib/market/indicators` and Python `ai-service/quant`. The spec requires one source of truth for product signals.
- Alert evaluation: two Inngest functions (above).

## Environment variables

Missing in Vercel production:

| Variable | Needed for | Source |
| --- | --- | --- |
| `INNGEST_EVENT_KEY` | Sending events | Inngest dashboard |
| `INNGEST_SIGNING_KEY` | `/api/inngest` | Inngest dashboard |
| `SENTRY_DSN` | Server error reporting | Sentry project (public client DSN already in `instrumentation-client.ts`) |
| `NEXT_PUBLIC_POSTHOG_KEY` | Product analytics | PostHog project |
| `CRON_SECRET` | Optional internal health/ops routes | Generate |

`BETTER_AUTH_URL` in the local `.env` points to `signalist-test-vibe-wa44.vercel.app`, not `signalist-blue.vercel.app`. The production value must be checked.

## Dead code and repo noise

- `Stock trading app prototype*/`, `Signalist 21stdev ui prompts/`, `files/`, `family_playlist.py`, `people_birthdays.py`, `playlist.dat` are unrelated or superseded.
- `.claude/skills` is tracked (831 files). `.agents/` and `QuantAgent*` are untracked and should stay out of lint.
- `database/test-db-connection.js` is a manual script.

None of this was removed. Deleting it needs the owner's sign-off.

## Architectural concerns

- **No persistent worker on Vercel.** Provider WebSockets cannot be held open server-side. Live crypto can stream from Binance directly to the browser. Stock and server-side data stay on polling.
- **Inngest quota.** A one-minute cron plus per-symbol steps can exceed the free tier. Batch steps per function, not per symbol.
- **Finnhub free tier.** 60 calls per minute, and `stock/candle` is paid. Candles come from Yahoo for stocks and Binance for crypto.
- **Atlas M0 storage.** Retain 1-minute data briefly and use TTL indexes.
- **Render free tier sleeps** after 15 minutes idle. AI is enrichment, so calls need short timeouts and deterministic fallback.
- **`NEXT_PUBLIC_FINNHUB_API_KEY`** is exposed to browsers. Server code should use `FINNHUB_API_KEY` only.

## Spec conflict resolved

Global and project `CLAUDE.md` ask for Liquid Glass, heavy motion and acid lime. The product spec (section 38) says avoid unnecessary glassmorphism and glow and preserve the working visual identity. The app's current identity is the v3 editorial system. **Decision: follow the product spec and extend the existing `--sg-*` editorial tokens.**

## Inngest budget

The free plan allows 50,000 executions a month, and each step counts as one. The original functions would have used well over 200,000 a month: `poll-market-prices` alone was 4 executions a minute (172,800).

| Function | Schedule | Executions a month |
| --- | --- | --- |
| `poll-market-prices` | Every 2 minutes, no steps | 21,600 |
| `capture-market-snapshots` | Every 15 minutes, one event send when signals fire | Up to 5,760 |
| `check-price-alerts` | Removed, merged into the poller | 0 |

## Milestone 1 progress

Done, not deployed:

- Removed the duplicate alert cron (Broken item 2) and cut Inngest usage to about 27,000 executions a month, leaving room for summaries and email.
- Added `lib/ai/service.ts` with timeouts (Broken item 6) and deterministic fallback for "what changed" (Broken item 7).
- Research errors no longer show users developer instructions like `npm run ai:dev`.
- Added `GET /api/health` and `ai_provider` to FastAPI `/health`.
- ESLint now ignores `.agents/` and `QuantAgent/`: 0 errors.

Gate, waiting on the owner:

- [x] `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` in Vercel production (confirmed 2026-11-02)
- [ ] Inngest Custom Production Domain set to `signalist-blue.vercel.app`, because Vercel protection blocks per-deployment URLs
- [ ] `signalist-test-vibe-yeg5` disabled in the Inngest Vercel integration
- [ ] Production deploy of this branch (owner approves at the end)
- [ ] Render updated, because it lacks `/agent/whats-changed`
- [ ] Production job run: poll, alert, snapshot, signal, daily digest (owner approved the real digest to all 3 users)
- [ ] `SENTRY_DSN` set and a test error received

## Milestones

| # | Milestone | Status |
| --- | --- | --- |
| 1 | Stabilize | Code done, production verification blocked on Inngest keys |
| 2 | Normalize | Not started |
| 3 | Intelligence engine | Not started |
| 4 | AI | Not started |
| 5 | Signals UX | Not started |
| 6 | Connect existing product | Not started |
| 7 | Developer platform | Not started |
| 8 | Hardening | Not started |
