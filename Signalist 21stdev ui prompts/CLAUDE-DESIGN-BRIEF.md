# Signalist × Claude Design — Handoff Brief

**Audience:** Claude Design (or any design agent) integrating the 21st.dev prompt pack into Signalist.  
**Repo:** https://github.com/Primz1/Signalistfordesign  
**Goal:** Turn a working dark trading app into a **professional, cohesive product UI** — TradingView density + Linear polish + amber brand — by adapting (not blindly pasting) the 21st.dev components in this folder.

---

## 1. What we are trying to achieve

Signalist is a **retail investor “command center”**: watchlists, alerts, paper trading, AI research (quant math in Python → Gemini narrates typed snapshots), and a developer API.

The product **already works**. This pass is **visual + interaction quality**, not new product scope.

### Success looks like
1. One consistent visual system across auth → dashboard → watchlist → portfolio → research → stock detail → settings → API.
2. Dense, trustworthy finance UI: mono numbers, clear hierarchy, amber accent, green/red market semantics.
3. Premium 21st.dev pieces **re-skinned** to Signalist tokens (no leftover purple/cyan/glassmorphism).
4. Instant nav (skeletons) + clear button pending states (already started — keep them).
5. Overlays feel native: ⌘K search, notifications, user menu, alert dialog, trade ticket.

### Explicit non-goals
- No light mode in this pass.
- No cool accent colors (blue / purple / teal / cyan).
- No glassmorphism, neumorphism, 3D charts, emoji, illustration-heavy empties.
- Do **not** replace TradingView market widgets wholesale.
- Do **not** invent new product routes — design what exists.

---

## 2. Brand tokens (non-negotiable)

| Token | Value | Use |
|-------|-------|-----|
| `bg-base` | `#0A0A0A` | App background |
| `bg-elevated` | `#141414` | Cards, header, popovers |
| `bg-elevated-2` | `#1C1C1C` | Row hover, nested surfaces |
| `border-subtle` | `#242424` | Dividers |
| `border-strong` | `#2E2E2E` | Controls |
| `text-primary` | `#F5F5F5` | Titles |
| `text-secondary` | `#A1A1A1` | Body |
| `text-tertiary` | `#6E6E6E` | Meta / captions |
| `accent` | `#FDD458` | CTAs, active nav, AI marker |
| `accent-hover` | `#E8BA40` | Hover |
| `warm` | `#F97316` | Hero glow only (sparingly) |
| `up` | `#22C55E` | Gains / BUY |
| `down` | `#EF4444` | Losses / SELL |

**Type:** Geist Sans for UI · **Geist Mono for all numbers** (prices, %, qty, timestamps in tables).  
**AI surfaces:** 2px amber left border + Sparkles — never a second brand color.  
**Atmosphere:** subtle noise / warm radial is OK; avoid neon cyberpunk unless recolored to amber/charcoal.

---

## 3. App map (what must be designed)

```
AUTH
  /sign-in
  /sign-up          (+ country, goals, risk, industry)

SHELL (every logged-in page)
  BrandLogo | Nav | ⌘K Search | Bell notifications | Avatar menu
  Mobile: nav lives in avatar dropdown (upgrade with drawer optional)

PAGES
  /                 Dashboard — tape, hero NAV/P/L, markets widgets, watchlist preview, research cards
  /watchlist        Add symbol, table, alerts + create dialog, recent alerts, news
  /portfolio        Summary, trade ticket, holdings accordion, allocation, AI review
  /portfolio/history Filters, CSV, realized P/L table, undo
  /research         Symbol + query, factor cards, narrative
  /stocks/[symbol]  Chart, indicators, watchlist star, AI blurb → research
  /developers       API keys (nav label: API)
  /settings         Profile prefs
```

---

## 4. Current component architecture (centralized)

Page routes under `app/` are thin. **UI lives in `components/`:**

```
components/
  ui/            # shadcn primitives + shiny-button (already from 21st)
  layout/        # Header, AppHeader, BrandLogo, NavItems, UserDropdown, RouteLoadingSkeleton
  search/        # SearchCommand (⌘K) — REPLACE with P0 Command palette
  market/        # TradingViewWidget wrappers
  charts/        # CandlestickChart, SignalBadges, StockChartSection
  dashboard/     # TickerTape, HeroSymbolChart
  watchlist/     # WatchlistClient, WatchlistTable, WatchlistButton
  portfolio/     # PortfolioClient, TradeHistoryClient
  research/      # ResearchClient (FactorCard local)
  developers/    # DevelopersClient
  settings/      # SettingsForm
  forms/         # InputField, SelectField, CountrySelectField, FooterLinks
  providers/     # PostHog
```

**Existing primitives in `components/ui`:** button, input, label, dialog, dropdown-menu, select, popover, avatar, command, table, skeleton, sonner, shiny-button.

**Missing (often arrive via 21st prompts):** tabs, accordion, sheet/drawer, tooltip, progress, badge, calendar, alert, scroll-area, switch.

---

## 5. 21st.dev prompt pack — how to use

Folder: `Signalist 21stdev ui prompts/`

Each `.txt` is an **integration prompt** with full component source. Treat them as **raw materials**:

1. Integrate into `components/ui/` (or a feature folder if product-specific).
2. **Retheme** hard to Signalist tokens above.
3. **Wire** to existing data/actions — do not leave demo/mock data in production paths.
4. Prefer replacing the hand-rolled surface listed below rather than stacking duplicates.

### P0 — do first

| Prompt file | Target surface | Replaces / upgrades |
|-------------|----------------|---------------------|
| `P0/Command pallet.txt` | Global ⌘K search | `components/search/SearchCommand.tsx` |
| `P0/Auth Section.txt` | `/sign-in`, `/sign-up` | Auth pages + forms kit |
| `P0/Data-Table.txt` | Watchlist + trade history | `WatchlistTable`, history table |
| `P0/Candle Chart.txt` | `/stocks/[symbol]` | `components/charts/CandlestickChart.tsx` |
| `P0/Animated SVG Gradient.txt` | Auth / hero atmosphere | Flat + noise background |
| `P0/Animated Neon Dither Background.txt` | App/auth backdrop | Recolor neon → amber/charcoal or skip if too loud |
| `P0/Interactive Empty State.txt` | Watchlist, alerts, trades, keys | Dashed empty copy blocks |
| `P0/No internet connection state.txt` | Global offline | New system empty |
| `P0/Scheduled Maintenance Empty State component.txt` | Status / downtime | Ops empty (optional) |
| `P0/Dashboard Application Shell Skeleton Loading Screen.txt` | Route loading | `RouteLoadingSkeleton` |

### P1 — next

| Prompt file | Target surface |
|-------------|----------------|
| `P1/marquee.txt` | Dashboard ticker tape |
| `P1/notification dropdown.txt` | Header bell panel |
| `P1/user dropdown.txt` | Avatar menu (+ mobile nav) |
| `P1/News Card.txt` | Watchlist news grid |
| `P1/Donut chart.txt` | Portfolio allocation pie |
| `P1/Country select.txt` | Sign-up + Settings country |
| `P1/Toast Notification.txt` | Global toasts (upgrade Sonner skin) |
| `P1/Trading pamel last resort not advised.txt` | Portfolio trade ticket — **last resort only**; prefer polishing the existing inline ticket |

### P2 — polish

| Prompt file | Target surface |
|-------------|----------------|
| `P2/Tabs.txt` | Research sections / history filters |
| `P2/Accordion.txt` | Portfolio holdings expand |
| `P2/Alert.txt` | Rules-fired / verify banner / callouts |
| `P2/Confidense meter.txt` | Research confidence + AI score |
| `P2/Calender.txt` | Trade history custom date range |
| `P2/mobile nav drawer.txt` | Mobile navigation (replace avatar-only nav) |

---

## 6. Integration rules for Claude Design

1. **One system, many parts.** After swaps, header / tables / cards / empties must feel like one product.
2. **Adapt, don’t dump.** Strip demo lead CRM columns from Data-Table; map to Symbol · Price · Change · Volume · AI Score · Actions (watchlist) and Date · Side · Qty · Price · Realized (history).
3. **Keep behavior.** Watchlist add/remove, alerts CRUD, paper trades, undo (5 min), research factor→narrative, quant snapshot fields — all stay.
4. **Motion budget.** Prefer 2–3 intentional motions (palette open, skeleton shimmer, subtle sheen). No perpetual neon noise on every page.
5. **Accessibility.** Focus rings on amber, keyboard for ⌘K and menus, reduced-motion respect (prompts use `useReducedMotion` — keep it).
6. **Dependencies.** Many prompts want `framer-motion` / `motion`. Prefer one motion library; align with package.json. Avoid duplicate `cn` helpers — use `@/lib/utils`.
7. **File placement.** UI primitives → `components/ui/`. Product wiring stays in feature folders (`watchlist/`, `portfolio/`, etc.).
8. **Trading panel prompt** is labeled last-resort — only use if the current inline trade ticket cannot be elevated cleanly.

---

## 7. Priority delivery sequence (recommended)

1. Tokens + backgrounds (auth + app atmosphere)  
2. Auth Section  
3. Command palette → wire Finnhub/Binance search + watchlist star  
4. Skeleton shell + empty states  
5. Data table → watchlist + history  
6. Candle chart on stock detail  
7. Notification + user dropdown  
8. Marquee, news cards, donut, country select, toasts  
9. Tabs / accordion / confidence meter / calendar / mobile drawer  

---

## 8. Reference reading in-repo

- `files/signalist-designer-brief.md` — full visual system (older, still valid for tokens & page specs)
- `app/globals.css` — live CSS variables / surface utilities
- `lib/constants.ts` — `NAV_ITEMS` and widget configs
- `components/layout/AppHeader.tsx` — current chrome

---

## 9. One-line brief for Claude Design

> Redesign Signalist into a professional amber-on-near-black trading command center by integrating the 21st.dev components in `Signalist 21stdev ui prompts/` (P0→P2), retheming them to our tokens, and wiring them into the existing feature folders — preserving all product behavior while upgrading search, auth, tables, charts, empties, overlays, and atmosphere to Linear/TradingView quality.
