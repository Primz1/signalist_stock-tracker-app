# Signal engine

How Signalist turns market data into signals. Everything here is deterministic: the same
bars always produce the same events, scores and lifecycle. The AI only explains the result.

```
Provider candles (1m) ─▶ series.ts ─▶ detectors.ts ─▶ signal-engine.ts ─▶ Signal
                          analytics     MarketEvent     correlation,
                          per bar                       scoring.ts, lifecycle
```

Production runs this inside the 2-minute `poll-market-prices` Inngest function
(`lib/intelligence/pipeline.ts`). Tests and `replay.ts` run the identical code bar by bar.

## 1. Analytics (`series.ts`)

Computed once per bar from 1-minute candles. Each value at bar *i* uses only bars up to *i*.

| Field | Definition |
| --- | --- |
| `change1/5/15/60` | Percent change over n bars. NaN when it would span two sessions, so overnight gaps aren't intraday moves |
| `returnStd` | Standard deviation of 1-bar returns over the trailing 240 bars, skipping session-boundary NaNs. The "usual move" |
| `ema20/50/200`, `sma20/50/200` | Moving averages of closes |
| `rsi` | RSI(14), Wilder smoothing |
| `macd`, `macdSignal`, `macdHistogram` | 12/26/9 |
| `atr` | ATR(14), Wilder smoothing |
| `vwap` | Session VWAP, resetting each New York trading day (UTC day for crypto) |
| `relativeVolume` | Volume of the last 15 bars ÷ the same 15 minutes in up to 5 earlier sessions. Falls back to the median of earlier 15-bar windows when fewer than 2 sessions exist. Same-time comparison stops every market open looking like a spike |
| `volatilityRatio` | 30-bar return stdev ÷ its median over the previous 240 bars |
| `resistance`, `support` | Highest high and lowest low of the 60 bars ending 5 bars ago. Stocks use the current session only |
| Daily context | Previous close, high and low from daily candles |

## 2. Detectors (`detectors.ts`)

Every detector is **edge-triggered**: it fires on the bar where its condition becomes true.
Stocks skip the first 15 bars of each session while the range forms.
A per-detector cooldown stops the same event repeating.

| Event | Fires when | Cooldown |
| --- | --- | --- |
| `PRICE_MOVE` | n-bar move ≥ 3σ (σ = `returnStd`·√n) **and** ≥ a floor: stocks 0.35/0.7/1.2%, crypto 0.5/1.0/1.8% for 1/5/15 bars. High severity at ≥ 5σ | 15 min |
| `VOLUME_SPIKE` | `relativeVolume` crosses 2.5×. High at 4× | 30 min |
| `BREAKOUT` / `BREAKDOWN` | Close crosses beyond resistance/support by max(0.25·ATR, 0.1%) with relative volume ≥ 1.3× | 60 min |
| `RSI_EXTREME` | RSI crosses 70 or 30 | 60 min |
| `MOMENTUM_ACCELERATION` | RSI changes ≥ 15 points over 5 bars and the MACD histogram agrees | 30 min |
| `MACD_CROSS` | Histogram changes sign | 30 min |
| `MOVING_AVERAGE_CROSS` | EMA20/EMA50 gap flips sign and opens to ≥ 0.03% of price | 60 min |
| `VWAP_CROSS` | Stocks only. Close crosses VWAP by 0.1% | 30 min |
| `VOLATILITY_EXPANSION` / `CONTRACTION` | `volatilityRatio` crosses 1.8× / 0.5× | 60 / 120 min |

Events are stored in `MarketEvent` with a unique `dedupeKey` of symbol, type, direction
and bar time. A retried run can't write an event twice.

## 3. Correlation (`signal-engine.ts`)

Events on one asset, in one direction, within **30 minutes** form one story.

A new signal needs an **anchor**: `PRICE_MOVE`, `VOLUME_SPIKE`, `BREAKOUT` or `BREAKDOWN`.
It also needs either a high-severity anchor or at least two distinct event types. RSI, MACD,
moving-average and VWAP crossings happen constantly on 1-minute bars, so they add
confidence but can't start a signal. Volatility-only signals need `volatilityRatio` ≥ 2.7.

A directional signal also needs **strength ≥ 45** when it starts. Events with no real
price move behind them stay events and never become a card.

Only one signal per asset per direction can be open. New events in that direction update it.

## 4. Scoring (`scoring.ts`)

**Strength** (0-100) is how forceful the move is. **Confidence** (0-100) is how much
independent evidence agrees. They are separate on purpose: one huge candle is high strength
and low confidence.

Components, each 0-1, are stored on the signal (`components`):

| Component | Formula |
| --- | --- |
| `trend` | Share of {close vs EMA20, close vs EMA50, EMA20 vs EMA50, close vs VWAP (stocks)} that agree with the direction |
| `momentum` | Mean of clamp((RSI−50)/25 in direction) and MACD histogram agreeing (1/0) |
| `volume` | clamp((relativeVolume − 1) / 2.5) |
| `breakout` | 1 if a breakout (or breakdown) in the signal's direction is in the cluster, else 0 |
| `volatility` | clamp((volatilityRatio − 1) / 1.5) |
| `relativePerformance` | clamp((asset move − benchmark move) / 2 points, in direction) |
| `marketConfirmation` | clamp(market move / 1 point, in direction) |
| `news` | 1 when news is attached, otherwise not measured |

```
priceForce = clamp(15-bar move in units of 15-bar σ / 6)
strength   = 100 × (0.30·priceForce + 0.20·momentum + 0.20·volume + 0.15·breakout + 0.15·trend)

breadth    = min(1, weighted supporting event types / 3)
             price, volume, level and news types weigh 1, oscillator crossings 0.5
agreement  = support / (support + against)
             support = supporting event types + components ≥ 0.6 among trend, momentum, volume
             against = opposing event types + components ≤ 0.2 among trend, momentum
                       + 1 if priceForce ≤ 0.1 (price isn't moving the signal's way)
coverage   = measured components / 8
confidence = 100 × (0.45·breadth + 0.35·agreement + 0.20·coverage)
```

Direction label: strength ≥ 70 is *Strong bullish/bearish*, otherwise *Bullish/Bearish*.
Severity is high when strength and confidence are both ≥ 70, medium when strength ≥ 45.

## 5. Market context (`context.ts`)

Asset move vs SPY (market) and a sector ETF from the Finnhub industry (e.g. SMH for
semiconductors), measured from 15 minutes before the signal began. Altcoins compare with BTC.

| Class | Rule |
| --- | --- |
| market-driven | Market moved ≥ 0.25%, same sign, and the asset is within max(0.5, |market|) points of it |
| sector-driven | Same test against the sector ETF |
| asset-specific | Asset differs from the sector (or market) by ≥ max(0.75, 2×|benchmark|) points |
| mixed | Anything else |
| unknown | No benchmark |

## 6. Lifecycle

| Status | Rule |
| --- | --- |
| DETECTED | Created |
| ACTIVE | Survived 15 minutes without invalidation |
| WEAKENING | Strength fell below 60% of its peak. Back to ACTIVE at 80% |
| INVALIDATED | Close moved back through the key level by 0.15%, or a qualifying opposite signal formed |
| RESOLVED | No supporting event for 90 minutes, or the stock session ended |

The **key level** is the broken resistance or support. Otherwise it is the close 15 bars
before the first event, so giving the whole move back invalidates the signal. ACTIVE and
WEAKENING must hold 10 minutes before switching, so status doesn't flap.

**Publishing.** Every signal is stored. Users, alerts and the AI only hear about a signal once
it is *confirmed*: it reached ACTIVE, or it started with strength ≥ 55. A move that reverses
within minutes never becomes a notification. After that, only status changes publish to the
live feed. Strength changes alone update the stored signal silently.

Open signals are saved at the end of every run, so the next run resumes exactly where the last
stopped. Production and replay produce the same signals bar for bar, which the integration test checks.

## 7. Replay

Measured on real 1-minute data from 2026-10-30 to 2026-11-03: about 2 confirmed signals per
session for NVDA, AAPL and TSLA, 1 for SPY, and 4 to 7 per 16 hours for BTC and ETH.


`replay()` runs the same code over historical bars. `lib/intelligence/replay.test.ts`
covers a quiet random walk across 12 seeds, which must produce no high-severity signals and
at most one weak signal per run on average, plus a true breakout, a false breakout, market
context, and a 24/7 crypto drop. `REPLAY_SYMBOL=NVDA npm run replay` replays real recent bars (read-only).

Tune thresholds against replay results across many symbols and days, never one stock or one day.
