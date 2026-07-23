# Signalist — UI Revamp Designer Brief

## 1. Product context

**Signalist** is a full-stack financial intelligence platform for retail investors who want more than a broker app but less than a Bloomberg terminal. It combines:

- **Market data & charting** — real-time quotes and candlesticks (Finnhub, Binance) rendered with Lightweight Charts, plus RSI, MACD, Bollinger Bands, SMA(20/50) overlays.
- **Watchlists + price alerts** — user-defined symbol lists with threshold alerts delivered by email (Nodemailer + Inngest background jobs).
- **Paper trading** — a simulated portfolio with buy/sell, holdings, P/L, and allocation view.
- **AI research agent** — Google Gemini via a FastAPI service that returns structured research reports (summary, confidence, signals, sources), persisted in MongoDB.
- **Developer API** — users can generate keys and hit Signalist's own endpoints.

The user is: a retail investor / prosumer trader who is comfortable seeing indicators like RSI and MACD, but wants an AI layer that helps them cut through the noise. Think "TradingView + a research analyst in your pocket."

The app already works. **This brief is about visual and interaction polish, not new features.**

---

## 2. Design direction

### Reference points
- **TradingView** — density, precision, information-first layout, monospace numbers, minimalism in chrome.
- **CoinGecko** — clean tables, breathable spacing on cards, comfortable data hierarchy.
- **Kaito, Dune, Nansen** — serious "quant tool" energy: mono type for figures, tight rows, minimal decoration.
- **Linear** — for interaction quality: instant feedback, ⌘K, keyboard-first, no bloat.

### What we're keeping (non-negotiable)
- **Dark-only theme for now.** Near-black background stays. Light mode isn't ruled out long-term, but it's not in scope for this revamp — every component would need a light variant, which roughly doubles the design and implementation work. Tokens are authored so light can be layered on later without a rewrite.
- **Yellow/amber as the primary brand accent.** This is Signalist's brand signature and what separates it from TradingView (blue) and CoinGecko (green). We lean into it, and we add warm supporting hues (burnt orange, warm gold, deep amber) for gradients, atmospheric depth, and data-viz variety — never cool colors.
- **Geist Sans + Geist Mono.** Mono is used for all numbers.
- **Green up / red down** for market moves.
- **All existing routes and features.** Nothing gets deleted.

### What we are NOT doing
- No blue accent. No purple accent. No teal, cyan, or any cool hue. No rainbow / "crypto casino" gradients. But warm amber → burnt-orange gradients, radial glows, and atmospheric backdrops are the whole point — use them.
- No glassmorphism, no neumorphism, no 3D charts.
- No light mode in v1 (design tokens can support it later; not shipped now).
- No mascot, no illustration-heavy empty states. Icons and short copy only.
- No emoji in product UI.

---

## 3. Brand system

### Color

Extend the existing palette into a proper scale. Keep the current amber but define supporting tokens so the app stops relying on ad-hoc grays.

**Surface (dark)**
- `bg-base` — `#0A0A0A` (was `#050505` — lift one notch so cards read as elevated)
- `bg-elevated` — `#141414` (cards, popovers)
- `bg-elevated-2` — `#1C1C1C` (hover on rows, secondary cards)
- `border-subtle` — `#242424`
- `border-strong` — `#2E2E2E`

**Text**
- `text-primary` — `#F5F5F5`
- `text-secondary` — `#A1A1A1`
- `text-tertiary` — `#6E6E6E`
- `text-inverse` — `#0A0A0A` (for on-amber CTAs)

**Accent (amber — brand)**
- `accent-500` — `#FDD458` (primary CTA background)
- `accent-600` — `#E8BA40` (hover)
- `accent-700` — `#B8912F` (pressed)
- `accent-300` — `#FFE694` (highlights, hero type gradients)
- `accent-100` — `#FDD458` at 12% alpha (badge backgrounds, subtle highlights)

**Warm supporting (for gradients, glows, atmosphere, data-viz variety)**
- `warm-500` — `#F97316` (burnt orange — hero gradient endpoint, featured chart glow)
- `warm-600` — `#EA580C` (deeper burnt orange — gradient midpoints)
- `warm-400` — `#FB923C` (soft orange — sparks, spot accents)
- `warm-800` — `#7C2D12` (near-black burnt sienna — deep background wash)
- `gold-500` — `#EAB308` (warm gold — secondary chart series, callouts distinct from amber)
- `sand-300` — `#FDE68A` (pale straw — subtle text highlights on dark hero backgrounds)

**Gradient tokens** (used sparingly, for hero moments and atmospheric backdrops)
- `gradient-hero` — radial, from `#F97316 at 22%` at center-top, fading through `#7C2D12 at 8%` to `#0A0A0A at 0%` at edges. This is the "glow behind everything" on the landing hero and dashboard hero card.
- `gradient-cta` — linear 135°, from `#FDD458` → `#F97316`. Used for the hero CTA button only, to give the marketing page a signature moment. Normal buttons stay flat amber.
- `gradient-text` — linear 90°, from `#FFE694` → `#FDD458` → `#F97316`. Applied to marketing headlines with `background-clip: text`.
- `gradient-chart-fill` — vertical, from `#FDD458 at 24%` at top → `transparent` at bottom. Used as the area fill under line charts.

**Market**
- `up-500` — `#22C55E`
- `up-100` — `#22C55E` at 12% (badge bg)
- `down-500` — `#EF4444`
- `down-100` — `#EF4444` at 12% (badge bg)
- `neutral-500` — `#A1A1A1` (flat / no change)

**Signals** (already exist, formalize)
- Bullish → up-500
- Bearish → down-500
- Warning → accent-500
- Neutral → text-secondary

Rule: no other hues. If you find yourself wanting a third color for "info" or "AI insight," use amber at reduced alpha. AI/agent surfaces get an **amber left border 2px** as their marker — not a separate hue.

### Typography

Geist Sans for everything except numbers. Geist Mono for all numerical output: prices, percentages, quantities, ticker P/L, indicator values, timestamps in dense tables. This one rule alone will make the app feel more "pro."

Scale:
- `display` — 32/40, weight 600, tight tracking (-0.02em) — page H1s
- `h1` — 24/32, weight 600
- `h2` — 20/28, weight 600
- `h3` — 16/24, weight 600
- `body` — 14/20, weight 400
- `body-sm` — 13/18, weight 400
- `caption` — 12/16, weight 500, tracking +0.02em, often uppercase for column headers
- `mono-lg` — 20/28, Geist Mono, weight 500 (headline prices)
- `mono` — 14/20, Geist Mono, weight 400 (table numbers)
- `mono-sm` — 12/16, Geist Mono (secondary numbers, chart axes)

### Radius, spacing, elevation

- Radius scale: `4` (badges, chips), `8` (inputs, buttons, small cards), `12` (main cards, dialogs), `16` (hero cards on dashboard). Keep `--radius: 0.625rem` as the default (`8`).
- Spacing: 4px base grid. Tight rows use 8/12, comfortable use 16/20, section separation 24/32/48.
- No shadows on dark surfaces except dialogs/popovers (subtle black-alpha shadow + 1px border). Elevation is communicated by border and background lift, not by drop shadow.

### Iconography

Lucide only. `16px` in inline / table contexts, `18px` in buttons, `20px` in headers, `24px` in empty states. `1.5` stroke width consistently. Every icon button gets an `aria-label` and a `<Tooltip>` on desktop hover.

### Motion

- Standard easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`, duration `150ms` for micro (hover, focus), `220ms` for panels/dialogs, `320ms` for page-level transitions.
- Chart values animate: prices tick with a **200ms flash** (up-100 bg → transparent, or down-100 → transparent) on change. No number "roulette" animation — just a background flash.
- Skeletons pulse at 1400ms; no shimmer sweep (skip the gradient shimmer, use opacity pulse — it reads cleaner).
- Toasts slide up from bottom-right (desktop) / top-center (mobile), 4s auto-dismiss for success, sticky for errors.
- **Ticker tape marquee** (see §3.5) scrolls left continuously at 40px/s. Pauses on hover. Reduces to 20px/s under `prefers-reduced-motion`.
- **Hero chart lines** on the marketing landing draw in over 1200ms on load, then subtly pulse (opacity 60% → 80% → 60% at 6s cadence).
- **Ambient glow** on hero cards breathes slowly — the radial amber glow shifts opacity 40% → 55% → 40% over 8s. Barely perceptible; adds life.

### Atmosphere & depth

This is the section that fixes "black + yellow feels flat." The goal is to make the app feel alive without introducing cool colors or cluttering the UI.

**Radial glows** — Every "hero" surface (marketing hero, dashboard hero card, auth right panel, AI research report header) sits on top of a `gradient-hero` radial glow. It's positioned behind the content, `pointer-events: none`, `z-index: 0`. The glow is *the* signature move — it gives the black background depth and warmth. Never use it on utility surfaces (tables, forms, settings).

**Grid backdrop** — Behind the marketing hero and dashboard hero: a 1px `#242424` grid at 40×40px, masked with a radial fade so it dissolves toward the edges. Adds "trading terminal" texture without competing with content. Grid opacity 40%. Never on utility pages.

**Noise texture** — 4% opacity monochrome noise overlay on all `bg-base` surfaces (whole-page background). Kills the "flat void" feeling that pure `#0A0A0A` gives. Ship as a single tiled SVG or PNG.

**Chart area fills** — Every line/area chart gets a `gradient-chart-fill` under the primary series. Even the small sparklines on indicator cards. This is what makes TradingView's charts feel "premium" rather than "line on black."

**Live ticker tape** — Full-width horizontal strip, `48px` tall, `bg-base` with a thin `border-b border-subtle`. Continuously scrolling row of tickers: `SYMBOL 180.50 +1.24%` in mono, colored per direction. Placed at the very top of the marketing landing AND the top of the logged-in dashboard (above the header on marketing, below the header on dashboard). Real driver of "this is a live market app."

**Signal sparks** — When AI signals fire (bullish/bearish/warning), a brief 400ms glow pulses the badge outward — like a sonar ping. Warm orange for warning, up/down for bullish/bearish. Once per new signal, not on every render.

**Hero-card border glow** — Cards marked as "hero" get a 1px `border-accent-500 at 30%` and a soft outer glow (`box-shadow: 0 0 60px -20px #F97316 at 20%`). Reserved for the dashboard hero card and the featured research report.

**Depth via layered surfaces** — Every dark app can look flat if it uses one bg color. We use four surface levels (`bg-base`, `bg-elevated`, `bg-elevated-2`, plus a `bg-hero` for hero surfaces that sits above the radial glow). Cards nest and stack; the eye reads elevation because levels differ by 4–8% luminance.

---

## 4. App shell

### Header (logged-in)

- Height `56px` (down from 70 — TradingView is tight, so are we).
- Sticky, `bg-elevated`, `border-b border-subtle`.
- Left: Logo (wordmark + mark), then a **⌘K search field** that looks like an input (`bg-base`, ghost border, placeholder `Search stocks... ⌘K`) — clicking or focusing opens `SearchCommand`. This replaces the current "Search" nav item and matches the Linear/Vercel pattern. On mobile it collapses to a search icon.
- Center/right nav: Dashboard · Watchlist · Portfolio · Research · API · Settings. Active item: `text-primary` + 2px amber underline. Hover: `text-primary`. Inactive: `text-secondary`.
- Far right: notifications bell (badge count for unread alerts) → opens Alerts panel drawer, then UserDropdown.

### UserDropdown

- Avatar: real user avatar if uploaded; fallback is `bg-accent-100` circle with mono initial in `text-primary`. **Remove the hardcoded shadcn image.**
- Menu contents (desktop): Name + email header, then Settings, Theme (locked to Dark for now — leave the row as a hint that light will come), Sign out.
- On mobile: same menu, plus the full nav collapsed underneath the account section? **No.** We add a proper mobile nav instead (below).

### Mobile navigation

- Hamburger button appears at `<sm`, opens a right-side `Sheet` (shadcn) covering ~80% width.
- Sheet contents: search input at top, then vertical nav (large tap targets, 48px min height), then user block at the bottom.
- The user dropdown on mobile ONLY does account actions (avatar, name, email, sign out). Nav lives in the sheet.

### Command palette (SearchCommand)

- Preserves all current behavior (recent stocks, add-to-watchlist star).
- Visual pass: `bg-elevated`, `border border-strong`, 12px radius, backdrop blur on the overlay, `max-w-2xl`.
- Row layout: leading trending-up icon in `text-tertiary`, then **company name (`text-primary`)** with the ticker + exchange chip on the right in mono-sm, `text-secondary`. "In watchlist" is a tiny amber-outlined pill (`border-accent-500 text-accent-500 bg-accent-100`), not solid green.
- Empty state: centered, `text-tertiary`, small caption "Try a ticker like AAPL or TSLA."
- Loading: replace star with 14px spinner in `text-accent-500`.

---

## 5. Auth screens

### Layout & inspiration

Adopt the **21st.dev sign-in pattern** as the base — it's a stronger starting point than the current auth screens. Two-column, animated entrance, glass inputs, floating testimonial cards over the hero image. See the delivered `sign-in.tsx` for the working component; the specs below are the design rules around it.

- Left panel: `bg-background` (`bg-base`), ~50% width on desktop, single-column form, `max-w-md`, vertically centered. A subtle radial amber wash sits behind the form content (`radial-gradient(600px circle at 50% 0%, primary/8%, transparent 70%)`) — it's the visual anchor that keeps the form from feeling flat.
- Right panel: ~50%, full-bleed hero image inside a `24` inset (`inset-4 rounded-3xl`). Amber wash (`linear-gradient(135deg, primary/18%, transparent 45%, warm-500/14%)`) overlays the image so any photo reads as Signalist-branded. Bottom-gradient darkening for testimonial legibility.
- Right panel hidden below `md`. Auth becomes a single-column form on mobile, no marketing lost.
- Hero image: financial / trading-themed Unsplash photo. Reference: `photo-1642615835477-d303d7dc9ee9` (dark trading terminal). Any moody dark data / market photo works.

### Entrance animations

Every element in the left column fades + un-blurs + slides up in a staggered cascade (`fadeSlideIn`, 700ms, 100ms per element from title down to the "Create account" link). The hero image slides in from the right (`slideRightIn`, 900ms, 300ms delay). Testimonial cards animate in later (`testimonialIn`, 800ms, 1000/1200/1400ms delays). The page lands feeling composed, not thrown together. All animations respect `prefers-reduced-motion`.

### Sign-in

- Title: "Welcome back" — `font-light tracking-tighter`, 40/48 (mobile) → 48/56 (desktop). Softer weight than the rest of the app, on purpose — auth is a "moment," not a utility screen.
- Sub: "Sign in to keep tracking your signals — real-time charts, AI research, and price alerts." `text-muted-foreground`, 14/20.
- **Glass inputs**: `rounded-2xl border-border bg-foreground/5 backdrop-blur-sm`, focus lifts to `border-primary/60 bg-primary/10`. Labels live above inputs in `text-muted-foreground caption`.
- **Password show/hide**: Eye / EyeOff (Lucide), 20px, `text-muted-foreground → text-foreground` on hover. `aria-label` swaps. Applied on sign-in AND sign-up.
- **Keep me signed in** checkbox (amber-filled, rounded, custom-styled) on the left, **Reset password** link (amber, hover underline) on the right — same row.
- Primary CTA: full-width, `rounded-2xl bg-primary py-4 text-primary-foreground`, hover `bg-primary/90`. Bigger vertical padding (16px) than the standard button — auth CTAs are the whole page's focal point.
- **Google sign-in**: divider `Or continue with`, then a full-width `border-border rounded-2xl` button with the Google icon. Optional via `showGoogleSignIn` prop — hide when OAuth isn't wired.
- Footer: "New to Signalist? Create account" — link in amber (`text-primary`).

### Sign-up

Same visual chrome as sign-in, extended fields:

1. **Account** — Full Name, Email, Password (with eye).
2. **Market** — Country (searchable combobox, flag on the left; helper `text-muted-foreground` below: "Used to prioritize the exchanges you care about.").
3. **Preferences** — Investment Goals, Risk Tolerance, Preferred Industry.

Group with `caption` uppercase labels and hairline `border-t border-border` between sections. Same glass-input treatment throughout. Primary CTA: "Create account" / loading "Creating…". Footer link: "Already have an account? Sign in."

### Testimonials (right panel)

Three cards float over the bottom of the hero image, arranged horizontally with wider viewports showing more:
- `<xl`: 1 card visible.
- `xl`: 2 cards.
- `2xl`: 3 cards.

Card style: `rounded-3xl border-white/10 bg-zinc-900/40 backdrop-blur-xl p-5 w-64 shadow-2xl`. Contents: 40×40 avatar (rounded-2xl) + name (`font-medium`) + handle (`text-muted-foreground`) + quote (`text-foreground/80`, 3-line clamp).

Use the Signalist testimonial set (delivered in `sign-in-demo.tsx`): 0xxghost (retail investor), Nadia Rehman (options trader), Marco Alvarez (long-term investor). Match the audience — no "productivity" or "seamless" filler copy.

### Errors

Inline under-field errors: `text-destructive` (or `down-500`), 12px, with a 12px alert icon inline. Fields with errors get their glass border swapped to `border-destructive` and a subtle `bg-destructive/5` fill.

### Verify banner

If `?verify=1` — thin amber-outlined card above the form: `bg-primary/10 border-primary/40`, dismiss X on the right, message body in `text-foreground`.

---

## 6. Pages

### 6.0 Marketing landing (public `/`)

**New route consideration.** Right now `/` is the logged-in dashboard. We propose auth-based routing: unauthenticated users on `/` see this marketing landing; authenticated users on `/` see the dashboard (§6.1). Same URL, different content — same pattern as TradingView, Robinhood, Notion.

The landing is where we spend the visual budget. It should feel unmistakably alive.

**Structure (top → bottom)**

**Ticker tape bar** — full-width, edge-to-edge, `bg-base` with `border-b border-subtle`. Scrolling row of live tickers (see §3.5). Sits above the header.

**Header** — transparent over the hero, no border. Logo left. Nav: Product · Markets · Research · API · Pricing (placeholders OK). Right: "Sign in" (ghost) and "Get started" (gradient-CTA amber → burnt orange). On scroll past 80px, header solidifies to `bg-elevated at 85%` with backdrop blur and picks up `border-b border-subtle`.

**Hero section** — full viewport height minus header (~`calc(100vh - 56px)`), minimum `720px`.

Backdrop stack (behind content, `z-0`):
1. `bg-base` with 4% noise texture
2. Grid backdrop (40×40, `#242424` at 40%), radial-masked so it fades toward edges
3. `gradient-hero` radial glow, biased to the upper-right — burnt orange at 22% opacity fading to transparent. Slow breathing animation (§3 motion).
4. An animated **abstract chart line** SVG traced across the lower third — thin `accent-500` line with `gradient-chart-fill` under it, drawing in over 1200ms on load, then subtly pulsing. This is the eye-catch.
5. **Interactive layer** — see "Interactive backdrop" below.

### Interactive backdrop

The whole point of the marketing landing is to feel alive without being flashy. Two mouse-driven effects, both restrained, both optional. Nothing else.

**1. Cursor-follow spotlight** (primary interactive move)
- A `600px` radial gradient of `hsl(var(--primary) / 0.10)` fading to transparent, positioned absolute, `pointer-events: none`, `mix-blend-mode: soft-light` or `overlay`.
- Follows the cursor with **300ms ease-out lag** (feels alive, not glued). Implementation: track `mousemove`, throttle to `requestAnimationFrame`, update a CSS custom property on the container (`--cursor-x`, `--cursor-y`).
- Renders **only** in the hero section — kill it once the user scrolls past the fold. The rest of the page is calm.
- Fallbacks:
  - Touch devices (`(hover: none)`): no spotlight at all.
  - `prefers-reduced-motion`: no spotlight.
  - Firefox / Safari without `mix-blend-mode` performance: fall back to low-opacity screen blend.

**2. Subtle parallax on hero visuals** (secondary)
- The radial glow, the grid backdrop, and the hero product shot shift by a **maximum of 8px** based on cursor position (offset scaled by cursor delta from center, divided by 60). Each layer moves at a slightly different rate:
  - Grid: 0.3× (barely moves)
  - Glow: 1× (base)
  - Chart line SVG: 1.5× (most responsive)
  - Product shot: 0.5×
- Uses `transform: translate3d()` with `will-change: transform`. GPU-accelerated, no reflow.
- Same fallbacks as spotlight.

**What we're explicitly NOT doing**
- No cursor trail / particle sparkles.
- No `webgl` shaders, `three.js`, or `p5.js`. Everything is CSS + a few lines of vanilla JS.
- No scroll-triggered elements flying in from off-screen. Sections fade in place with a light stagger, that's it.
- No physics-based interactions (springs, magnetic buttons). Save that for a redesign v2.

The rule: if a first-time visitor doesn't consciously notice the interactivity — but the page still feels *alive* — it's calibrated correctly.

Content stack (`z-10`, centered, `max-w-6xl`):
- **Eyebrow chip** — small pill, `border-accent-500 at 40%`, amber dot on the left, caption text like `Signals · Research · Alerts`. Sets the tone before the headline lands.
- **Headline** — `display` size bumped to 56/64 on desktop (weight 600, tracking -0.02em). Two lines, `gradient-text` applied to a key phrase (`Trade the signal, not the noise.` — the "the signal" or "the noise" gets the amber → orange gradient). This is the single most visible use of `gradient-text` in the app.
- **Subheadline** — 18/28, `text-secondary`, max-width `620px`, centered. One sentence: "AI-powered market research, real-time charts, and paper trading — built for retail investors who want more than a broker app."
- **CTA row** — two buttons side by side. Primary: `gradient-cta` "Start free" with `ArrowRight` icon. Secondary: ghost "See it live" with `Play` icon, opens a modal with a product tour (out of scope to build, but design the entry point).
- **Trust row** — small caption "Live data from Finnhub · Binance" with the two logos in `text-tertiary`, or 3–4 press quotes as tiny mono chips. Grounds the hero.
- **Hero product shot** — a large screenshot / mock of the stock detail page floats at the bottom of the hero, cropped so the top ~60% is visible. Sits in a rounded `12` frame with `border-accent-500 at 20%` and a soft outer glow. This is where TradingView shows their app; we do the same.

**Live markets strip** — below the hero, a compact horizontal strip of 6–8 major tickers as cards. Each card: symbol, mono price, mono %change (colored), tiny inline sparkline with `gradient-chart-fill`. Cards hover-raise. Reinforces "live data."

**Feature sections** — 3 alternating rows, each a two-column split (copy left, product visual right, then flipped). Sections:
1. **Real-time charts, pro-grade indicators.** Show the candlestick + RSI + MACD stock detail page. Caption pills of the indicators supported.
2. **AI research on any ticker.** Show the research report card. Emphasize confidence meter, signals, sources.
3. **Watchlists, alerts, paper trading.** Show a collage: watchlist table snippet + alert dialog + portfolio pie.

Each row: H2 headline, body-copy paragraph, three bullet capabilities with small amber check icons, and a "Learn more" text-link with arrow. Product visual gets a subtle amber radial glow behind it.

**Social proof / testimonial band** — full-width, `bg-elevated`, three testimonial cards in a row, each with 5 stars, quote, name + role. This is where the existing "-0xxghost / Retail Investor" quote goes; add two more.

**Final CTA band** — full-width, `bg-hero` (on top of `gradient-hero`), giant H1 "Ready to trade the signal?", subheadline, primary gradient CTA. Give this section serious vertical padding (`py-32`) — it should feel like an arrival.

**Footer** — `bg-base`, 4 columns (Product / Company / Resources / Legal), logo + small tagline in the first column, socials as icons at the bottom, copyright caption. Nothing flashy; the hero already did the work.

**Mobile** — hero headline drops to 40/48, product shot becomes a phone-framed mock, feature rows stack, ticker tape stays but at 32px tall, gradient-CTA button becomes full width.

---

### 6.1 Dashboard (logged-in `/`)

Current state: four TradingView widgets in a 2×2, one mislabeled, no titles on two, unused Button import. We fix that AND make it feel like a command center rather than a widget salad.

**Structure (top → bottom)**

**Ticker tape** — same component as marketing, sits directly below the app header.

**Hero card** — full-width, `~360px` tall, `bg-hero` on top of `gradient-hero` (glow biased upper-left), `12` radius, `border-accent-500 at 30%`, soft outer glow.
- Left half: greeting ("Good evening, Jeremy"), portfolio value in mono-lg, P/L today with colored pill, one-liner AI insight from the agent ("Your holdings are up on strong tech; NVDA leads. Watch AMD's earnings Thursday.") in `text-secondary` with the `Sparkles` icon.
- Right half: featured mini-chart. Shows either the user's top holding or a "market of the day" symbol — full candlestick with `gradient-chart-fill`, ~200px tall, no toolbar chrome, clickable to open the full stock detail page. Symbol/price overlaid top-left.
- Bottom-left of card: 3 small chips as quick actions — "Add symbol" (opens SearchCommand), "New alert" (opens dialog), "Run research" (opens research with focus).

**Watchlist strip** — compact horizontal scroller of watchlist symbols as small cards (~140px wide each). Each card: symbol, company (2-line clamp), price mono, %change colored, tiny sparkline. Hover raises. Clicking opens stock detail. If watchlist is empty, this strip shows a single dashed card "Add your first symbol" that opens SearchCommand.

**Markets grid** — 2×2 of TradingView widgets, but visually tightened:
```
┌──────────────────────────┬──────────────────────────┐
│  Market Overview         │  Stock Heatmap           │
├──────────────────────────┼──────────────────────────┤
│  Top stories / timeline  │  Market quotes           │
└──────────────────────────┴──────────────────────────┘
```
- Every widget gets a proper title bar: `caption` uppercase label on the left, small `MoreHorizontal` icon on the right (menu with "Refresh," "Open in fullscreen").
- Widget cards: `bg-elevated`, `border border-subtle`, `12` radius, `p-0` on the card + `p-4` on the header (border-bottom).
- Height: TradingView embeds ~480px on desktop (down from 560 since we now have a hero card taking the top). Mobile: stack, ~420px.
- Fix the Market Overview / Stock Heatmap config mislabel from the current build.

**Latest research strip** — three most recent AI reports as cards. Each: symbol chip, question echoed, confidence meter, signal pills. Hover raises. Empty: hide the strip entirely (empty state lives on `/research`).

**Ambient background** — the whole page sits on `bg-base` + noise texture. The hero card's glow bleeds subtly into the surrounding space (dashboard container gets an `overflow: hidden` and the hero's glow extends past its bounds by ~40px).

On mobile, hero card stacks (greeting/insight above the mini-chart), watchlist strip stays horizontal-scroll, markets grid becomes 1-column stack, research strip becomes horizontal-scroll.

### 6.2 Watchlist (`/watchlist`)

Overall page layout:

- Two-column: 2/3 for the table + news, 1/3 for the alerts rail. On `<lg`, alerts becomes a tab above the table ("Symbols" | "Alerts") or moves below.
- Header row: H1 "Watchlist" left, "Add to watchlist" button right (amber CTA with `Plus` icon 16px).

**Table**

Give the table real hierarchy:
- Row height 56px, hover `bg-elevated-2`, focus visible ring in amber.
- Star column (28px wide): filled amber `Star` for saved, click removes (with confirm dialog — see §7).
- Assets: 32px avatar circle with monogram (ticker's first 2 chars, `bg-accent-100 text-primary` mono), company name `text-primary`, exchange chip below in `text-tertiary caption`.
- Symbol: mono, `text-primary`.
- AI Score: pill. `0–39` uses `down-100 bg / down-500 text`, `40–69` uses `accent-100 bg / accent-500 text`, `70–100` uses `up-100 bg / up-500 text`. Format: `72/100` in mono.
- Price: mono-lg, `text-primary`, right-aligned.
- Change %: mono, colored by direction, with a leading arrow icon 12px.
- Day High/Low: two-line stack — high on top, low below, both mono-sm, `text-secondary`.
- Alert: if no alert exists, ghost button `+ Add alert`. If an alert exists, show a compact `Bell` icon + threshold (mono-sm) that opens the alert directly.

Empty state: full-width dashed card, `border-strong dashed`, `bg-elevated`, centered `LineChart` icon 24px `text-tertiary`, H3 "No symbols yet," body-sm "Add a ticker to start tracking prices and signals," amber CTA "Search stocks."

**Alerts rail**

- Card `bg-elevated`, header "Alerts" + "New" button (amber, `Plus` icon).
- Alert card: symbol monogram · company + ticker · frequency pill (`caption` in `accent-100 bg / accent-500 text`) · row 2: `Bell` icon + condition text `> $175.00` (mono for the number) with the current live price on the right, colored by whether it's approaching the threshold (within 2%: amber; met: up/down).
- Actions: Pause/Resume (`Pause` / `Play` icon button), Delete (`Trash2` — confirm dialog).
- Empty state: same treatment as table empty, smaller, with a `BellOff` icon and body-sm "You'll get an email when a price crosses your threshold."

**Price Alert dialog**

- `max-w-md`, `bg-elevated`, `12` radius.
- Order of fields: Name, Symbol (searchable — reuse SearchCommand style inline), Condition (segmented control `> / <` — cleaner than a dropdown for two options), Threshold ($ prefix, mono), Frequency select.
- Live preview strip at the bottom: "Alert when AAPL price is greater than $180.00, at most once per day." in `text-secondary` — reinforces the config in plain English.
- Primary: "Create alert." Secondary: "Cancel."

**Recent Alerts (notifications)**

- Bell icon in header shows unread count in a small amber pill.
- Panel: sticky "Mark all read" text button top-right.
- Unread items: `border-l-2 border-accent-500` + `bg-accent-100 at 4%`.
- Toasts on new fire: amber toast, `Bell` icon, symbol + condition met.

**News grid**

- 3 columns on `lg+`, 2 on `md`, 1 on mobile.
- Card: `bg-elevated`, `12` radius, `border-subtle`. Source chip (`caption` uppercase, `text-tertiary`) + time ago. Headline in H3 (2-line clamp). Summary in body-sm `text-secondary` (3-line clamp). Footer: "Read more" (amber text) + `ArrowUpRight` 14px.
- Empty state matches the pattern — no news → hide the section rather than showing a large empty block.

### 6.3 Stock detail (`/stocks/[symbol]`)

This is the flagship page. Make it look like a real trading terminal.

**Header block**
- Breadcrumb: `Watchlist / AAPL` in `text-tertiary`, `caption`.
- Row: 40px avatar monogram · Company name (h1) · ticker (mono-sm in `text-secondary` bracketed) · exchange chip.
- Right: WatchlistButton — `Add to watchlist` outline / `Remove` outline in `down-500`. Pending: label swap to "Working…" + spinner. **Keep the trash SVG for the "remove" state**, currently unused.
- Below name row: giant mono price (mono-lg one size up, ~32px) + change % pill next to it, both colored. Below that: session range, mono, `text-secondary`, `caption` labels ("O 178.20 · H 181.05 · L 176.90 · C 180.50 · Vol 42.1M").
- AI Score pill floats on the right of this block: `AI Score 72/100` styled per the scoring rules above.

**Chart section**
- Full-width, `bg-elevated`, `12` radius, `border-subtle`.
- Toolbar: timeframe tabs `1D · 5D · 1M · 3M · 6M · 1Y · 5Y · ALL` (segmented control, active is `bg-elevated-2 text-primary`, inactive `text-secondary`). Chart type toggle: candles / line / area. Indicator toggle chips: `SMA20` (amber outline), `SMA50` (blue swap → use amber at reduced alpha, or a lighter gray, since **we banned blue** — pick a light gray `#8A8A8A`), `RSI`, `MACD`, `BB`.
- Candles: green/red use `up-500` / `down-500`. Wicks match. Volume bars under price at 25% opacity.
- Crosshair: 1px `text-tertiary` dashed lines, tooltip card in `bg-elevated-2`, mono numbers.
- **Empty state (no candles):** full-height dashed card inside the chart body, `LineChart` icon 32px `text-tertiary`, H3 "No chart data yet," body-sm "This symbol has no available candles right now. Try another timeframe."

**Indicator panel**
- Row of small cards below chart: RSI (with 30/70 zones highlighted), SMA20, SMA50, MACD histogram sparkline, Bollinger bands sparkline.
- Each card: `caption` label, mono value, tiny trend indicator (up/down arrow, colored).

**Signal badges row**
- Horizontal pill row above AI card: bullish / bearish / neutral / warning — use the colors from §3.

**AI Analysis card**
- Distinct treatment: `bg-elevated` + `border-l-2 border-accent-500` on the left edge (this is the "AI surface" pattern).
- Header: `Sparkles` icon (Lucide) 16px `text-accent-500` + "AI analysis" caption.
- Body: summary text in body, `text-primary`. If missing: `text-tertiary` italic fallback "AI analysis is being generated..." with a 14px spinner.
- Footer link: `Run full AI research on AAPL →` in amber, arrow icon 14px.

### 6.4 Portfolio (`/portfolio`)

Two-column on `lg+`, single-column below.

**Left column**
- Card: "Total value" — mono-lg 32px, and P/L row below (absolute + %, colored).
- Allocation pie: Recharts, but restyle. Slice colors use grayscale (`#F5F5F5`, `#A1A1A1`, `#6E6E6E`, `#4A4A4A`) with the largest slice in amber. This keeps it on-brand and avoids the default rainbow palette.
- Legend below the chart, not to the right, so the chart itself gets more room.

**Right column**
- Trade card: `bg-elevated`, `12` radius. Symbol input at top (default AAPL, with a small "Change" affordance that opens SearchCommand). Qty input (mono). Segmented **Buy / Sell** control at the bottom (Buy = amber, Sell = down-500 outline). Below: preview strip "Buy 10 AAPL @ ~$180.50 = $1,805.00" in `text-secondary`.

**Cash line**: below the trade card, `caption` "Cash" + mono-lg value.

**Holdings table**: mirrors Watchlist table styling. Columns: Symbol · Qty · Avg cost · Price · P/L (currency + %). Empty state: dashed card, `Briefcase` icon, "No positions yet," CTA "Make your first trade."

**AI Portfolio Review card**: same AI surface pattern (left amber border, Sparkles icon). "Analyze" button top-right. Report renders below with sections: Diversification · Risk exposure · Suggested rebalancing.

### 6.5 Research (`/research`)

- Two-column form at top: Symbol (searchable), Question (large textarea, min 3 rows). Placeholder "Should I watch AAPL?" prefilled based on symbol. "Research" button — amber, with `Sparkles` icon.
- Loading state: full-card skeleton with animated caption cycling "Fetching news… · Reading filings… · Reasoning…" every 1.5s. Better than a static "Loading research..."
- Report card layout:
  - Header: symbol chip + question echoed back in body.
  - **Confidence meter** at top: horizontal bar, filled to `confidence%` in amber, mono `72%` label at the end.
  - Signal pills row below.
  - Summary: body copy, `text-primary`, with subheadings (`h3`) for sections if the model returns them.
  - Sources: cards in a row, each showing favicon + source title + external-link icon. `text-primary` label, `text-tertiary` domain, hover raises to `bg-elevated-2`.
- Empty page state (no research yet in session): centered `FlaskConical` icon 32px, H3 "Ask about any ticker," body-sm "Get an AI-generated research report with signals, confidence, and sources."

### 6.6 Developers (`/developers`)

- Two-column: docs on the left (2/3), keys on the right (1/3). Stack on `<lg`.
- **Docs card**: `bg-elevated`, `12` radius. Section headers with `caption` uppercase. Code blocks in `bg-base`, `border-subtle`, Geist Mono, syntax highlight in muted grays + amber for strings. Copy button top-right of each code block.
- **Keys panel**:
  - "New key" button (amber, `Plus`).
  - New key reveal callout: `bg-accent-100 at 8%` + `border-accent-500 dashed`, contains the full key in mono, "Copy" button, warning body-sm "You won't see this again."
  - Keys list: rows with name, prefix (`sk_live_a3f9…` mono), request count, created date, and a "Revoke" ghost button (confirm dialog). Row hover raises.
- Empty state: dashed card, `Key` icon, "No API keys yet," CTA "Create your first key."

### 6.7 Settings (`/settings`)

Reorganize into a tabbed layout in preparation for future settings (Account, Notifications, Billing, etc.), even if only "Preferences" exists today.

- Tab strip at top, left-aligned: `Preferences` (active) · `Account` (placeholder, disabled with tooltip "Coming soon") · `Notifications` (placeholder).
- Preferences pane: same fields as sign-up, in the same sectioned layout (Market / Preferences). Save button in a sticky bottom bar of the form card: "Save changes" (amber) + "Discard" (ghost) — appear only when the form is dirty.

---

## 7. Cross-cutting UX patterns

### Loading states
- **Skeletons everywhere.** Every list, table, card that fetches data gets a skeleton in the shape of the final content. Skeleton fill: `bg-elevated-2`, animated with opacity pulse 40% → 70% → 40% at 1400ms. Never spin a full-page loader.
- Buttons in flight: label swap + inline 14px spinner. Never disable without visual reason.
- Chart initial load: skeleton candles (gray bars of varying heights, no color) while data resolves.

### Empty states
Establish one component with three variations (compact / default / hero) so all pages share it:
```
[Icon 24/32px, text-tertiary]
[H3 title, text-primary]
[Body-sm subtitle, text-secondary, max-w-sm centered]
[Optional CTA]
```
Container: dashed `border-strong`, `bg-elevated at 30%`, `12` radius, padded 32–48.

### Confirm dialogs
Destructive actions ALWAYS confirm: remove from watchlist, delete alert, revoke API key, sell entire position.
- Small dialog, `max-w-sm`.
- Title in H3, body explaining consequence.
- Buttons right-aligned: "Cancel" (ghost), destructive action in `bg-down-500 text-white`, hover `down-600`.

### Toasts (Sonner)
- Position: bottom-right desktop, top-center mobile.
- Success: `bg-elevated` + `border-l-2 border-up-500`, check icon.
- Error: `bg-elevated` + `border-l-2 border-down-500`, alert icon, **not** auto-dismissed.
- Info/Alert-fired: `border-l-2 border-accent-500`, bell icon.
- Never use toasts for validation errors — those belong inline in the form.

### Icon accessibility
Every icon-only button needs `aria-label` AND a `<Tooltip>` on hover (`delay=300ms`) with the same label. Tooltip style: `bg-elevated-2`, `caption` text, `border-subtle`, 6px radius.

### Focus states
Visible amber ring, 2px, offset 2px, on ALL interactive elements. Never remove the outline without replacing it.

### Number rendering
- Prices: 2 decimals except for crypto (up to 8, trim trailing zeros).
- Percentages: 2 decimals, always signed for changes (`+1.24%` / `−0.53%` — use the real minus sign U+2212 for alignment).
- Large numbers: k/M/B abbreviations in tables, full numerals in headers on hover.
- Numbers always in Geist Mono. Column-align by decimal point where possible using `font-variant-numeric: tabular-nums`.

### Responsive breakpoints
- `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536.
- Below `md`: single-column everywhere, tables become card lists (each row → a card), chart toolbars scroll horizontally.

### Global 404 / loading
Add `not-found.tsx` and `loading.tsx` at the app root.
- 404: centered, small "404" caption, H1 "Off the chart," body "This page doesn't exist," CTA "Back to dashboard."
- Global loading: minimal centered spinner in amber, 24px, with "Loading Signalist…" caption below — 200ms delay before showing, to avoid flash.

---

## 8. Accessibility floor

- Contrast: all text meets WCAG AA. `text-tertiary` on `bg-base` should be tested — if it fails at 12px, bump to `#7A7A7A`.
- Keyboard: full nav via keyboard, ⌘K from anywhere opens search, `Esc` closes any dialog/sheet.
- Focus order matches visual order on every page.
- Reduced motion: respect `prefers-reduced-motion` — kill skeleton pulse, kill price flash, keep instant state changes.
- All form fields have `<Label>` associated (visible or `sr-only`).

---

## 9. What to deliver

1. **Design tokens** (JSON or Figma variables) matching §3.
2. **Component library in Figma**: buttons (primary/secondary/ghost/destructive, sm/md/lg), inputs (default/error/disabled), selects, checkboxes, radio, segmented control, tabs, tooltip, dialog, sheet, popover, dropdown-menu, avatar, badge, chip, pill, skeleton, empty-state, toast (Sonner variants), table row.
3. **Charts**: candlestick + volume + overlays (SMA/BB), RSI panel, MACD panel, sparkline. All in the retuned palette. Empty-state variant included.
4. **Page mocks** (desktop `1440` + mobile `390`):
   - **Marketing landing** (public `/`) — hero with animated chart line + radial glow, live markets strip, 3 feature rows, testimonials, final CTA band, footer
   - Sign-in, Sign-up
   - **Dashboard** (logged-in `/`) — with the new hero card + ticker tape + watchlist strip
   - Watchlist (with items + empty)
   - Stock detail (with data + empty chart)
   - Portfolio (with holdings + empty)
   - Research (form + report)
   - Developers (with keys + empty, new-key reveal)
   - Settings
   - 404
5. **Atmospheric assets**: noise texture PNG/SVG, grid backdrop SVG, radial-glow reference, animated hero chart line as an SVG or Lottie prototype, ticker tape marquee prototype.
6. **Interaction notes / prototype** for: SearchCommand ⌘K flow, Price Alert dialog, Confirm dialog, mobile Sheet nav, toast stack, ticker tape marquee, hero chart line animation.
7. **Handoff doc**: token names → CSS vars → Tailwind class map, so the frontend can wire it up in one sweep.

---

## 10. Explicit "do not" list

- Do not introduce blue or purple anywhere.
- Do not add glass, blur-heavy overlays beyond dialog scrims, or neumorphism.
- Do not replace Geist. Do not add a third typeface.
- Do not use emoji in UI.
- Do not change any route, feature, or field name.
- Do not touch the `.yellow-btn` naming — the color and gradient can be re-derived, but the class stays for backwards compat.
- Do not build a light theme yet — but do author the tokens such that a light theme is a swap, not a rewrite.
- Do not use rainbow palettes on charts. Grayscale + amber + warm (gold, burnt orange) for chart series variety, market green/red only where semantic.
- Do not remove the AI research module's amber left-border pattern once introduced — that's the AI surface convention across the app.

---

## Short design brief (for a first conversation with the designer)

> Signalist is a dark, warm-toned, TradingView-adjacent retail investing tool. We're keeping every feature and route; we want a visual + interaction pass that makes it feel alive — like a live-market command center, not a v1 project. Reference TradingView for density and the marketing hero, CoinGecko for card comfort, Linear for interaction polish. Amber is the primary brand accent, supported by burnt orange and warm gold for gradients, glows, and atmospheric depth. No blue, no purple, no cool hues at all. Numbers in mono, dark-only for now, subtle borders over shadows, but hero surfaces get radial amber glows, grid backdrops, noise texture, and a live ticker tape. Two hero moments to design carefully: the public marketing landing (`/`) and the logged-in dashboard hero card. Deliverables: tokens, components, page mocks (desktop + mobile including landing), atmospheric assets, interaction notes.
