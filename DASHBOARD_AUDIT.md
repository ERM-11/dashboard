# Dashboard Project — Full Audit

**Date:** 2026-03-30
**Project root:** `C:\Users\ethan\projects\dashboard`
**Method:** Full static codebase read + `npm run build`

> **Note:** `npm run dev` / browser console check was not possible in this environment.
> Console behaviour is inferred from static code analysis — see §8.

---

## 1. Tech Stack

### npm Dependencies

| Package | Version | Role |
|---|---|---|
| `react` | ^18.2.0 | UI library |
| `react-dom` | ^18.2.0 | DOM renderer |
| `vite` | ^5.1.4 | Dev server & bundler |
| `@vitejs/plugin-react` | ^4.2.1 | React/JSX transform for Vite |
| `tailwindcss` | ^3.4.1 | Utility-first CSS framework |
| `postcss` | ^8.4.35 | CSS post-processing |
| `autoprefixer` | ^10.4.17 | Vendor prefix injection |
| `vite-plugin-pwa` | ^1.2.0 | Service worker + PWA manifest generation (devDependency) |

No runtime npm packages beyond React. All widget logic is vanilla JS + React hooks.

### CDN Imports (Google Fonts — `index.html`)

| Font | Weights |
|---|---|
| **Outfit** | 400, 500, 600, 700, 800 |
| **DM Sans** | 300, 400, 500, 600 (normal + italic) |
| **JetBrains Mono** | 400, 500, 600 |

### Build Output

```
vite v5.4.21 building for production...
✓ 46 modules transformed.

dist/registerSW.js              0.13 kB
dist/manifest.webmanifest       0.51 kB
dist/index.html                 1.25 kB │ gzip:   0.59 kB
dist/assets/index-*.css        23.45 kB │ gzip:   5.17 kB
dist/assets/index-*.js        472.59 kB │ gzip: 144.07 kB

✓ built in 1.75s

PWA v1.2.0
mode      generateSW
precache  8 entries (488.43 KiB)
files generated
  dist/sw.js
  dist/workbox-354287e6.js
```

Zero warnings. Zero errors. Build is clean.

---

## 2. File Structure

```
dashboard/
├── index.html                        # App shell: Google Fonts CDN, PWA meta tags, viewport-fit=cover
├── package.json                      # Dependencies and npm scripts
├── package-lock.json                 # Lockfile
├── vite.config.js                    # Vite + VitePWA plugin (manifest, workbox runtime caching)
├── tailwind.config.js                # Extends: brand colour #3b82f6, custom font families, darkMode: class
├── postcss.config.js                 # Tailwind + autoprefixer pipeline
├── CLAUDE.md                         # Project rules and conventions for Claude Code
├── DASHBOARD_AUDIT.md                # This file
├── .gitignore                        # Ignores: node_modules/, dist/, .DS_Store, *.local, STATUS_CHECK.md
├── public/
│   └── icons/
│       ├── icon-192.png              # PWA icon 192×192
│       ├── icon-512.png              # PWA icon 512×512
│       └── icon-maskable-512.png    # PWA maskable icon 512×512
├── scripts/
│   └── generate-icons.cjs           # One-off Node script that generated the PWA icons (not part of build)
└── src/
    ├── main.jsx                      # ReactDOM.createRoot, renders <App> in StrictMode
    ├── App.jsx                       # Root: header, live clock, drag-and-drop widget grid, dark mode toggle
    ├── index.css                     # Tailwind base + directives, skeleton animation, .animate-reveal, safe-area padding
    ├── config.js                     # Exports LOCATION (lat/lng/timezone/name) — used by 3 weather widgets
    ├── components/
    │   ├── WeatherWidget.jsx         # 7-day forecast + expandable hourly panel (Open-Meteo)
    │   ├── PollenWidget.jsx          # Current pollen levels for 5 types (Open-Meteo Air Quality)
    │   ├── SunsetWidget.jsx          # 5-day sunset quality scores with cloud/condition breakdown (Open-Meteo)
    │   ├── NewsWidget.jsx            # Business RSS headlines with keyword filters (rss2json.com)
    │   ├── WordWidget.jsx            # Daily vocabulary word with Learn/Quiz modes (local JSON)
    │   ├── StockWidget.jsx           # Stock tracker: prices, sparklines, charts (Yahoo Finance)
    │   ├── GermanWidget.jsx          # German fill-in-the-blank exercises with streak calendar (local JSON)
    │   ├── CIMAWidget.jsx            # CIMA BA1–BA4 MCQ practice with spaced repetition (local JSON)
    │   └── ErrorBoundary.jsx         # Class-based per-widget crash boundary with reload button
    ├── hooks/
    │   └── useFetchData.js           # Generic fetch hook: { data, loading, error, lastUpdated, refresh }
    ├── utils/
    │   ├── migrateStorage.js         # One-time migration of legacy localStorage keys to dashboard_ prefix
    │   ├── api.js                    # ⚠️ DEAD CODE — fetchWithFallback/fetchJSON/formatDate helpers (not imported)
    │   └── location.js               # ⚠️ DEAD CODE — exports EDINBURGH {lat, lon} (not imported; superseded by config.js)
    └── data/
        ├── vocabulary.json           # 248 business/finance vocabulary words
        ├── german-exercises.json     # 100 German dialogue fill-in-the-blank exercises
        └── cima-questions.json       # 200 CIMA MCQ questions (50 per module: BA1/BA2/BA3/BA4)
```

---

## 3. Widget Inventory

### WeatherWidget
**File:** `src/components/WeatherWidget.jsx`

**Data displayed:**
7-day daily forecast cards: weekday label, WMO weather icon, max °C, min °C, precipitation mm. Clicking a day reveals a horizontally-scrollable hourly panel at 3-hour intervals (time, icon, temp °C, precip probability %, wind km/h).

**API:**
```
https://api.open-meteo.com/v1/forecast
  ?latitude=55.9533
  &longitude=-3.1883
  &daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode
  &hourly=temperature_2m,precipitation_probability,weathercode,windspeed_10m
  &timezone=Europe%2FLondon
```
Coordinates sourced from `src/config.js`. No API key. Refresh: every 15 minutes via `useFetchData`.

**localStorage keys:** None.

**User interactions:**
- Click day card — expands hourly panel (re-click collapses)
- ↻ button — triggers manual refresh via `useFetchData` `refresh()` callback

**Known limitations / issues:**
- `grid-cols-7` has no responsive fallback — 7 columns are squeezed on screens < ~380px
- No "current conditions" block — no real-time temperature shown
- Hourly panel uses `max-height` CSS transition (not animated mount/unmount)

---

### PollenWidget
**File:** `src/components/PollenWidget.jsx`

**Data displayed:**
Current snapshot of 5 pollen types (Grass, Birch, Alder, Ragweed, Mugwort) in grains/m³, each badged Low/Medium/High. Overall row shows the worst level across all types.

**Thresholds (hardcoded in component):**
| Pollen | Low | Medium | High |
|---|---|---|---|
| Grass, Birch | < 20 | 20–79 | ≥ 80 |
| Alder, Ragweed, Mugwort | < 10 | 10–49 | ≥ 50 |

**API:**
```
https://air-quality-api.open-meteo.com/v1/air-quality
  ?latitude=55.9533
  &longitude=-3.1883
  &current=grass_pollen,birch_pollen,alder_pollen,ragweed_pollen,mugwort_pollen
```
Coordinates from `src/config.js`. No API key. Refresh: every 15 minutes via `useFetchData`.

**localStorage keys:** None.

**User interactions:**
- ↻ button — manual refresh

**Known limitations:**
- Current snapshot only — no trend chart or forecast
- Thresholds are hardcoded; not user-configurable

---

### SunsetWidget
**File:** `src/components/SunsetWidget.jsx`

**Data displayed:**
5-day sunset quality scores (0–100) with label (Poor / Fair / Good / Great / Spectacular), sunset time, animated SVG score rings. Best day marked. Click any day to expand a detail panel: cloud layer bars (high/mid/low %), humidity %, visibility km, rain chance %.

**API:**
```
https://api.open-meteo.com/v1/forecast
  ?latitude=55.9533
  &longitude=-3.1883
  &daily=sunset
  &hourly=cloudcover,cloudcover_low,cloudcover_mid,cloudcover_high,
          precipitation_probability,relative_humidity_2m,visibility,weathercode
  &timezone=Europe%2FLondon
  &forecast_days=5
```
Coordinates from `src/config.js`. No API key. Refresh: every 30 minutes via `useFetchData`.

**Scoring algorithm** (ported from `sunset_notifier.py`):
- +35 pts: mid-level cloud — Gaussian peaked at 40%, σ=20%
- +20 pts: high cloud — linear
- −20 pts: low cloud — linear
- −10 pts: humidity > 70% — linear, full penalty at 100%
- −10 pts: precipitation probability > 30%
- −5 pts: visibility < 10 km — linear
- Raw range [−45, +55] shifted +45 → clamped [0, 100]

**localStorage keys:** None.

**User interactions:**
- Click day card — expands detail panel
- ↻ button — manual refresh

**Known limitations:**
- If `findHourlyIndex` finds no data at the exact sunset hour, scoring falls back to hardcoded defaults (cloudcover 50, cloudLow 30, cloudMid 20, cloudHigh 10, precipProb 0, humidity 70, visibility 10000)
- WMO icon fallback uses nearest lower code — may mismatch rare codes

---

### NewsWidget
**File:** `src/components/NewsWidget.jsx`

**Data displayed:**
Up to 5 business news headlines. Each shows: title, date, expandable description snippet (≤ 220 chars). Feed source shown in expanded view.

**API (rss2json.com, sequential fallback):**
```
https://api.rss2json.com/v1/api.json?rss_url=<encoded>
```
Feeds tried in order — first success wins:
1. BBC Business: `https://feeds.bbci.co.uk/news/business/rss.xml`
2. Reuters Business: `https://feeds.reuters.com/reuters/businessNews`

Free tier: 1,000 req/day, no API key. Refresh: every 30 minutes (internal `useEffect` interval).

> **Note:** NewsWidget does NOT use `useFetchData` — it has its own bespoke multi-feed fallback fetch loop using `useCallback`.

**localStorage keys:**
- `dashboard_newsFilter` — string. Values: `'All'` | `'EY / Big Four'` | `'UK Banking'` | `'Fintech'` | `'Consulting'`. Default: `'All'`.

**Filter keywords:**
| Filter | Keywords matched (case-insensitive) |
|---|---|
| EY / Big Four | ey, ernst young, ernst & young, deloitte, pwc, kpmg, big four, big 4 |
| UK Banking | bank, banking, hsbc, barclays, lloyds, natwest, nationwide, mortgage, lending |
| Fintech | fintech, digital banking, neobank, payments, revolut, monzo, starling, klarna |
| Consulting | consulting, advisory, management consulting, strategy |

**User interactions:**
- Filter tabs (All / EY / Banking / Fintech / Consulting) — persisted to localStorage
- Click headline — expands description
- ↻ button — manual refresh

**Known limitations:**
- rss2json.com 1,000 req/day limit — multiple open tabs or frequent manual refreshes can exceed it
- Reuters feed URL may be stale / returning errors
- `console.error` logged for each failed feed; both failing triggers "Failed to load news" error state

---

### WordWidget
**File:** `src/components/WordWidget.jsx`

**Data displayed:**
One word per day (deterministic by `dayOfYear % 248`). Shows: word, IPA pronunciation, part of speech, definition, example sentence. Quiz mode hides the word in the example sentence and accepts a typed answer.

**API:** None — reads `src/data/vocabulary.json` (static import).

**localStorage keys:**
- `dashboard_wordStats` — `{ known: number, new: number }`. Cumulative vote tally.
- `dashboard_wordVoteDate` — ISO date string `YYYY-MM-DD`. Prevents double-voting on the same day.
- `dashboard_quizStats` — `{ quizAttempts: number, quizCorrect: number }`. Lifetime quiz accuracy.

**User interactions:**
- **Know It / New Word** vote buttons — records to `wordStats`, blocked after first vote per day
- **Quiz** tab — switches to fill-in-the-blank mode
- Text input + **Check** button / Enter key — validates quiz answer (case-insensitive, umlaut-tolerant)
- **Learn** tab — returns to definition view

**Known limitations:**
- Quiz only tests today's word — no browse or spaced repetition
- Word cycle repeats every 248 days
- `quizStats` stored in a separate key from `wordStats` — no combined stats view

---

### StockWidget
**File:** `src/components/StockWidget.jsx`

**Data displayed:**
Compact list: ticker, price (USD), 24h change ($ and %), mini sparkline (last 8 hourly closes). Click any row to expand an SVG line chart with crosshair tooltip, OHLC + volume stats, range selector (1D / 3D / 1W / 1M). Add/remove ticker controls at the bottom.

**API (Yahoo Finance — unofficial, CORS-proxied):**
```
https://query2.finance.yahoo.com/v8/finance/chart/{TICKER}
  ?range={range}&interval={interval}
```
Proxy chain: `corsproxy.io` primary → `api.allorigins.win` fallback (hardcoded in component).

| Range tab | `range` | `interval` | Notes |
|---|---|---|---|
| Sparkline (always) | `5d` | `1h` | Last 8 data points = sparkline |
| 1D | `1d` | `5m` | Empty outside US market hours |
| 3D | `5d` | `1h` | Client-side filtered to last 3 days |
| 1W | `5d` | `1h` | Full 5-day response |
| 1M | `1mo` | `1d` | Daily OHLCV bars |

Fetch strategy: sequential with 400ms stagger between tickers. One auto-retry after 1.5s on failure. Per-request timeout: 10s. Refresh: every 5 minutes.

Price change computed as: `(regularMarketPrice − chartPreviousClose) / chartPreviousClose`.

> **Note:** StockWidget does NOT use `useFetchData` — it has its own full bespoke fetch engine with stagger, retry, timeout, and per-ticker state.

**localStorage keys:**
- `dashboard_stockTickers` — string array. Default: `["NVDA","GOOGL","AMZN","AVGO","AMD","SOFI","PLTR","NVO"]`.

**User interactions:**
- Click ticker row — expands chart panel (re-click collapses)
- Range selector (1D / 3D / 1W / 1M) — refetches data for selected range
- SVG chart crosshair — hover tooltip with price + date (mouse events only, no touch)
- Add ticker input + Enter / **+** button — adds new ticker, validates uppercase
- **×** button per ticker — removes from list
- ↻ button — re-fetches all tickers

**Known limitations:**
- Yahoo Finance is an unofficial endpoint — no SLA, has broken before
- CORS proxies (`corsproxy.io`, `api.allorigins.win`) are free public services with no SLA
- 8 tickers × 400ms stagger = ~3.2s minimum first load
- Chart data lives in component state — lost on re-render or page reload
- No touch/mobile support for chart crosshair
- 1D chart returns empty arrays outside US market hours (09:30–16:00 ET)

---

### GermanWidget
**File:** `src/components/GermanWidget.jsx`

**Data displayed:**
One fill-in-the-blank German dialogue exercise at a time. Shows: theme badge, level chip (A2/B1/B2), multi-line dialogue with inline text inputs. After submission: colour-coded feedback (green tick / red strikethrough + correct answer shown). Weekly streak calendar (Mon–Sun), progress bar (completed / pool size), accuracy percentage.

**API:** None — reads `src/data/german-exercises.json` (static import).

**Level assignment (by exercise ID):**
- IDs 1–30 → A2 (30 exercises)
- IDs 31–80 → B1 (50 exercises)
- IDs 81–100 → B2 (20 exercises)

**localStorage keys:**
- `dashboard_germanStats` — `{ completed: number[], correct: number, total: number }`. Tracks completed IDs and accuracy.
- `dashboard_germanStreak` — `{ count: number, lastDate: string }`. `lastDate` is ISO `YYYY-MM-DD`.
- `dashboard_germanLevel` — string. `'All'` | `'A2'` | `'B1'` | `'B2'`. Default: `'B1'`.
- `dashboard_germanMistakes` — number array of exercise IDs answered with at least one mistake.
- `dashboard_germanDates` — ISO date string array of days on which at least one exercise was completed.

**User interactions:**
- Level selector (All / A2 / B1 / B2) — filters exercise pool, persisted
- Text inputs in dialogue — one per blank
- **Check** button — validates all answers, updates stats and streak
- **Next** button (post-check) — loads next exercise from pool
- Streak calendar (display only)

**Answer normalisation:** `ae→ä`, `oe→ö`, `ue→ü`, `ss→ß`, then lowercased before comparison.

**Progress bar:** correctly divides by `getExercisesForLevel(difficulty).length` (not hardcoded 100).

**Known limitations:**
- No UI to reset stats or streak
- Small pools (A2=30, B2=20) repeat quickly once completed
- Exercise picker is random from remaining — no spaced repetition
- Streak only increments once per calendar day regardless of how many exercises are done

---

### CIMAWidget
**File:** `src/components/CIMAWidget.jsx`

**Data displayed:**
MCQ practice for CIMA BA1–BA4. Module tabs with distinct colour theming. Per-module progress bar and accuracy. Overall mini progress bars for all 4 modules. Question card: text, A/B/C/D options, difficulty badge. Post-answer: correct/incorrect feedback + explanation. Streak counter (🔥 at ≥ 7 days). Collapsible study history (last 10 of 50 stored entries with re-attempt button). Reset-module control.

**API:** None — reads `src/data/cima-questions.json` (static import).

**Question modes:**
- **Random** — picks from unattempted questions first, then loops
- **Review** — picks from spaced-repetition queue (questions due by today)
- **Weakest** — picks from the topic with the lowest accuracy in the active module
- **Daily** — deterministic by `dayOfYear % module.length`

**Spaced repetition logic:**
- Incorrect answer → added to review queue at interval = 1 day
- Correct review answer → interval doubled (capped at 30 days)
- Wrong again on review → interval reset to 1 day, `timesWrong` incremented

**Module colour theming:**
| Module | Accent |
|---|---|
| BA1 | Blue (`text-blue-400`, `border-blue-500`) |
| BA2 | Purple (`text-purple-400`, `border-purple-500`) |
| BA3 | Emerald (`text-emerald-400`, `border-emerald-500`) |
| BA4 | Amber (`text-amber-400`, `border-amber-500`) |

**localStorage keys:**
- `dashboard_cima_activeModule` — string. `'BA1'` | `'BA2'` | `'BA3'` | `'BA4'`. Default: `'BA1'`.
- `dashboard_cima_attempts` — object keyed by question ID: `{ attempts, correct, bookmarked, lastAttempted }`.
- `dashboard_cima_reviewQueue` — array: `[{ questionId, lastAttempted, interval, timesWrong }]`.
- `dashboard_cima_streak` — `{ current: number, best: number, lastStudyDate: string }`. `lastStudyDate` is ISO `YYYY-MM-DD`.
- `dashboard_cima_history` — array of up to 50 attempt records: `[{ questionId, module, topic, correct, date }]`.
- `dashboard_cima_dailyCompleted` — `{ [isoDate]: { [module]: true } }`.

**User interactions:**
- Module tabs (BA1–BA4) — switches active module
- Mode selector (Random / Review / Weakest / Daily)
- A / B / C / D option buttons — submits answer
- Bookmark button — adds question to review queue
- Reset module button — clears all attempts for active module
- History panel toggle — shows/hides last 10 study entries
- Re-attempt button in history — jumps to that specific question

**Grid:** `lg:col-span-2` — spans 2 of 3 columns on desktop.

**Known limitations:**
- Questions lack a `module` field — module identity comes from which array they live in; history records store `module` explicitly at write time
- No export/import of study progress
- No UI to remove individual bookmarks from the review queue

---

### ErrorBoundary
**File:** `src/components/ErrorBoundary.jsx`

Class-based React error boundary. Catches runtime errors in child widget trees. On crash: renders a card with ⚠️ and a "Reload Widget" button that calls `setState({ hasError: false })` to attempt re-render. Logs all crashes via `console.error('[ErrorBoundary] Widget crashed:', error, info.componentStack)`. One boundary wraps each widget in `App.jsx` — a crash in one widget is fully isolated.

---

## 4. Shared Utilities

### `src/config.js` — Location config
```js
export const LOCATION = {
  latitude:  55.9533,
  longitude: -3.1883,
  timezone:  'Europe/London',
  name:      'Edinburgh',
}
```
Imported by `WeatherWidget`, `PollenWidget`, `SunsetWidget`. Change once to update all three.

---

### `src/hooks/useFetchData.js` — Generic fetch hook
```js
export function useFetchData(url, refreshInterval)
// Returns: { data, loading, error, lastUpdated, refresh }
```
Fetches on mount, then re-fetches on `refreshInterval` ms (if truthy). Exposes `refresh()` to trigger a manual re-fetch. On error: sets `error` state and logs `console.error('[useFetchData] {url}: {message}')`. Used by `WeatherWidget`, `PollenWidget`, `SunsetWidget`. Not used by `NewsWidget` or `StockWidget` (both have bespoke fetch logic).

---

### `src/utils/migrateStorage.js` — Legacy key migration
Runs once at module load (called from `App.jsx` line 14, before any `useState` initialiser). Migrates 6 legacy keys to `dashboard_` prefix:

| Legacy key | New key |
|---|---|
| `wordStats` | `dashboard_wordStats` |
| `wordVoteDate` | `dashboard_wordVoteDate` |
| `stockTickers` | `dashboard_stockTickers` |
| `germanStats` | `dashboard_germanStats` |
| `germanStreak` | `dashboard_germanStreak` |
| `darkMode` | `dashboard_darkMode` |

On each migration: copies value to new key (if not already set), deletes old key, logs `console.log('[storage] migrated: X → Y')`. On subsequent loads with no legacy keys present: fully silent no-op.

---

### ⚠️ `src/utils/api.js` — DEAD CODE (not imported anywhere)
Exports: `fetchWithFallback`, `fetchJSON`, `fetchText`, `formatDate`, `formatTime`. Uses `api.allorigins.win` as its sole CORS proxy. Written as a general-purpose utility but never adopted by any widget. Can be safely deleted.

---

### ⚠️ `src/utils/location.js` — DEAD CODE (not imported anywhere)
Exports `EDINBURGH = { lat: 55.9533, lon: -3.1883 }`. Superseded by `src/config.js` which provides the full `LOCATION` object with timezone and name. Can be safely deleted.

---

### CORS Proxying

Two separate approaches exist in the codebase:

| Widget | Proxy strategy |
|---|---|
| WeatherWidget, PollenWidget, SunsetWidget | No proxy needed — Open-Meteo supports CORS |
| NewsWidget | No proxy needed — rss2json.com supports CORS |
| StockWidget | `corsproxy.io` primary → `api.allorigins.win` fallback (hardcoded in component) |
| `src/utils/api.js` (dead) | `api.allorigins.win` only |

---

### Error Handling Pattern

| Layer | Behaviour |
|---|---|
| `useFetchData` | Catches fetch errors → sets `error` state → widget renders error UI; logs to console |
| `NewsWidget` | Per-feed `try/catch`; if all feeds fail → `error` state shown |
| `StockWidget` | Per-ticker `try/catch` with 1 retry; logs `console.warn` on fetch; `console.error` on full failure |
| `ErrorBoundary` | Catches React render errors → fallback card; logs full component stack |
| `CIMAWidget`, `GermanWidget`, `WordWidget` | No fetch errors possible (local data); localStorage wrapped in `try/catch` for parse safety |

---

## 5. Styling System

### Colour Scheme (dark mode — default)

| Role | Value |
|---|---|
| Page background | `bg-slate-950` = `#020617` |
| Page radial glow (blue) | `rgba(59,130,246,0.07)` |
| Page radial glow (purple) | `rgba(139,92,246,0.04)` |
| Header bar | `bg-slate-900/95` (95% opacity) |
| Header gradient line | `#1e3a8a → #3b82f6 → #8b5cf6 → #f59e0b → #f43f5e` |
| Widget card | `bg-slate-800` = `#1e293b` |
| Widget card border | `border-slate-700` = `#334155` |
| Primary text | `text-slate-100` = `#f1f5f9` |
| Secondary text | `text-slate-300` = `#cbd5e1` |
| Muted / label text | `text-slate-400` = `#94a3b8` |
| Dimmed / disabled | `text-slate-500` = `#64748b` |
| Accent blue (brand) | `#3b82f6` (configured in `tailwind.config.js` as `brand`) |
| Positive / up | `text-green-400` = `#4ade80`, `bg-green-700` |
| Negative / down | `text-red-400` = `#f87171`, `bg-red-700` |
| Streak / fire | `text-amber-400` = `#fbbf24` |
| Skeleton shimmer | `#1e293b → #2d3b4f` |
| Drop target ring | `ring-blue-500/60` |
| SunsetWidget card | `linear-gradient(160deg, #1a1f2e, #1e1a2e)` (inline style) |

### Layout

| Property | Value |
|---|---|
| Grid columns | 1 (default) → 2 (`sm:` 640px) → 3 (`lg:` 1024px) |
| Max width | `max-w-[1600px] mx-auto` |
| Grid gap | `gap-4` (1rem) |
| Grid padding | `p-4` (1rem) |
| Dark mode strategy | `class` on `<html>` — toggled by App.jsx |

### Widget Card Pattern (7 of 8 widgets)
```
bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-4 flex flex-col gap-3
```
SunsetWidget uses an inline gradient background and `overflow-hidden` instead.

### CIMAWidget Grid Span
```js
const WIDGET_SPAN = { cima: 'lg:col-span-2' }
```
Applied via `${WIDGET_SPAN[id] || ''}` on each widget wrapper div.

### Font Assignment
| Token | Stack |
|---|---|
| `font-sans` | `DM Sans`, system-ui, sans-serif — body text |
| `font-display` | `Outfit`, system-ui, sans-serif — headings, labels |
| `font-mono` | `JetBrains Mono`, ui-monospace, monospace — stats, prices, time |

### Reusable CSS Classes (`src/index.css`)
| Class | Effect |
|---|---|
| `.skeleton` | Shimmer loading bar. `background-size: 200% 100%` animated at 1.6s ease-in-out |
| `.animate-reveal` | Entry: `scale(0.88) translateY(4px)` → `scale(1) translateY(0)`. Duration 0.28s spring |
| `.scrollbar-none` | `scrollbar-width: none` (Firefox) + `::-webkit-scrollbar { display:none }` (Webkit) |

### PWA / Mobile
- `viewport-fit=cover` on the viewport meta
- `env(safe-area-inset-top/bottom/left/right)` padding applied to `body` in `index.css`
- `theme-color: #020617`, `apple-mobile-web-app-capable: yes`, `apple-mobile-web-app-status-bar-style: black-translucent`

---

## 6. State Management

### App.jsx State

| State var | Type | Default | Persisted |
|---|---|---|---|
| `darkMode` | boolean | from `dashboard_darkMode` | `dashboard_darkMode` |
| `now` | Date | `new Date()` | No (live clock, 1s interval) |
| `order` | string[] | from `dashboard_widgetOrder` or `DEFAULT_ORDER` | `dashboard_widgetOrder` |
| `dropTarget` | number\|null | null | No (ephemeral drag state) |

All other state lives inside individual widget components (`useState` + direct localStorage read/write). No shared context, no Redux.

### Complete localStorage Key Reference

All 18 keys use the `dashboard_` prefix. Legacy keys migrated on first load by `migrateStorage.js`.

| Key | Owner | Shape | Notes |
|---|---|---|---|
| `dashboard_darkMode` | App.jsx | `"true"` / `"false"` | String, not boolean |
| `dashboard_widgetOrder` | App.jsx | `["weather","pollen",…]` | String array, 8 IDs |
| `dashboard_newsFilter` | NewsWidget | `"All"` or filter name | One of 5 string values |
| `dashboard_wordStats` | WordWidget | `{known:n, new:n}` | Cumulative all-time votes |
| `dashboard_wordVoteDate` | WordWidget | `"YYYY-MM-DD"` | ISO date; blocks revote |
| `dashboard_quizStats` | WordWidget | `{quizAttempts:n, quizCorrect:n}` | All-time quiz counts |
| `dashboard_stockTickers` | StockWidget | `["NVDA","GOOGL",…]` | Max display ~8–10 |
| `dashboard_germanStats` | GermanWidget | `{completed:[ids], correct:n, total:n}` | |
| `dashboard_germanStreak` | GermanWidget | `{count:n, lastDate:"YYYY-MM-DD"}` | ISO date |
| `dashboard_germanLevel` | GermanWidget | `"B1"` | `All`\|`A2`\|`B1`\|`B2` |
| `dashboard_germanMistakes` | GermanWidget | `[3,17,42]` | Exercise IDs |
| `dashboard_germanDates` | GermanWidget | `["2026-03-29",…]` | ISO dates, deduplicated |
| `dashboard_cima_activeModule` | CIMAWidget | `"BA1"` | |
| `dashboard_cima_attempts` | CIMAWidget | `{"BA1-001":{attempts,correct,bookmarked,lastAttempted},…}` | Grows over time |
| `dashboard_cima_reviewQueue` | CIMAWidget | `[{questionId, lastAttempted, interval, timesWrong}]` | |
| `dashboard_cima_streak` | CIMAWidget | `{current:n, best:n, lastStudyDate:"YYYY-MM-DD"}` | |
| `dashboard_cima_history` | CIMAWidget | `[{questionId, module, topic, correct, date}]` | Capped at 50 |
| `dashboard_cima_dailyCompleted` | CIMAWidget | `{"2026-03-29":{"BA1":true}}` | Grows indefinitely |

**Total: 18 keys.** No data is shared between widgets — each widget reads/writes its own keys independently.

---

## 7. Data Files

### `src/data/vocabulary.json`
- **Total entries:** 248
- **Selection:** `vocabulary[dayOfYear % 248]` — deterministic per day, repeats annually
- **Schema:**
  ```json
  {
    "word":          "string — the vocabulary word",
    "pronunciation": "string — IPA notation e.g. /ˈkætəlɪst/",
    "partOfSpeech":  "adjective | noun | verb | adverb",
    "definition":    "string — plain English definition",
    "example":       "string — business/finance context sentence"
  }
  ```
- **Parts of speech distribution:** adjective, noun, verb, adverb

---

### `src/data/german-exercises.json`
- **Total entries:** 100 (IDs 1–100)
- **Level distribution:** A2: 30 (IDs 1–30), B1: 50 (IDs 31–80), B2: 20 (IDs 81–100)
- **Dialogue lines per exercise:** always 3
- **Schema:**
  ```json
  {
    "id":       "number — 1–100",
    "theme":    "string — topic e.g. 'Beim Arzt', 'Im Büro', 'Am Bahnhof'",
    "dialogue": [
      {
        "speaker": "A | B",
        "german":  "string — full German sentence",
        "blank":   "string — sentence with one word replaced by ___",
        "answer":  "string — the missing word",
        "english": "string — English translation"
      }
    ]
  }
  ```
- **Sample themes:** Beim Arzt, Im Büro, Am Bahnhof, Im Restaurant, Einkaufen

---

### `src/data/cima-questions.json`
- **Total entries:** 200 (50 per module)
- **Structure:** Top-level object keyed by module: `{ BA1: [...], BA2: [...], BA3: [...], BA4: [...] }`
- **Schema (per question):**
  ```json
  {
    "id":          "string — e.g. 'BA1-001'",
    "topic":       "string — topic within module e.g. 'Macroeconomic Environment'",
    "difficulty":  "easy | medium | hard",
    "question":    "string — question text",
    "options":     { "A": "string", "B": "string", "C": "string", "D": "string" },
    "correct":     "A | B | C | D",
    "explanation": "string — explanation shown after answering"
  }
  ```
  Note: there is **no `module` field** on individual questions — module identity is derived from which array the question belongs to.
- **Difficulties present:** easy, medium, hard (mixed within each module)
- **Sample BA1 topics:** Macroeconomic Environment, Microeconomic Environment, The Financial System, International Trade and Globalisation, Information Systems and Technology

---

## 8. Current Issues / Gaps

### Blocking
None — build is clean, all widgets are functional.

### Dead Code (safe to delete)
| File | Issue |
|---|---|
| `src/utils/api.js` | Not imported by anything. Contains `fetchWithFallback`, `fetchJSON`, `fetchText`, `formatDate`, `formatTime`. Superseded by `useFetchData` + inline widget logic. |
| `src/utils/location.js` | Not imported by anything. Exports `EDINBURGH {lat, lon}`. Superseded by `src/config.js`. |
| `.Rhistory` | R session history accidentally committed. Not a web project file. |
| `scripts/generate-icons.cjs` | One-off icon generation script. Icons are already in `public/icons/`. No reason to keep in repo. |

### Non-Blocking Issues

| Widget | Issue | Detail |
|---|---|---|
| WeatherWidget | 7-column grid too narrow on small phones | `grid-cols-7` has no responsive override; 320px screens get ~43px per cell |
| WeatherWidget | No current conditions | Shows forecast only; no "right now" temp/icon |
| StockWidget | Chart data lost on re-render | `chartCache` lives in component state — cleared on unmount |
| StockWidget | No touch support on chart | Crosshair uses `onMouseMove` only — mobile users see no tooltip |
| StockWidget | Unofficial API | Yahoo Finance v8 has no SLA — can break without notice |
| StockWidget | 1D chart empty outside market hours | Returns empty array for US stocks outside 09:30–16:00 ET |
| SunsetWidget | Hourly fallback uses hardcoded values | If exact sunset hour missing from API response, scoring falls back to hardcoded cloud/humidity defaults |
| NewsWidget | Reuters feed may be stale | `feeds.reuters.com/reuters/businessNews` is a legacy URL |
| GermanWidget | No stats reset UI | No way for user to clear completed/mistakes from the widget |
| GermanWidget | Small pools repeat quickly | A2 (30) and B2 (20) exhaust fast |
| App.jsx | Drag-and-drop desktop-only | Drag handle is `hidden sm:flex` — mobile users cannot reorder widgets |
| CIMAWidget | `dashboard_cima_dailyCompleted` grows unbounded | Never pruned; will grow by 1 entry per day indefinitely |
| All widgets | `migrateStorage` logs on first load | `console.log('[storage] migrated: X → Y')` appears once per migrated key (only fires once, then stops) |

### API Rate Limits

| Service | Free Limit | Risk |
|---|---|---|
| Open-Meteo | Unlimited (non-commercial) | Negligible |
| rss2json.com | 1,000 req/day | Medium — 48 req/day normally; multiple tabs or manual refreshes approach limit |
| Yahoo Finance (unofficial) | Undocumented | High — no SLA; proxied via free public CORS services |
| corsproxy.io | Unknown | High — no SLA |
| api.allorigins.win | Unknown | High — fallback only |

### Console Output on Startup (inferred from static analysis)

| Condition | Output |
|---|---|
| First-ever load (legacy keys present) | `[storage] migrated: wordStats → dashboard_wordStats` (etc., one line per key) |
| Subsequent loads | Silent |
| Any fetch failure (weather/pollen/sunset) | `[useFetchData] <url>: <error message>` |
| NewsWidget — one feed fails | `Feed BBC Business failed: <error>` |
| StockWidget — ticker fetch fails | `console.warn fetchChart NVDA 5d: <message>` |
| Widget runtime crash | `[ErrorBoundary] Widget crashed: <error> <stack>` |
| PWA registration | `registerSW.js` registers service worker silently |

### PWA Note
`index.html` links `<link rel="manifest" href="/manifest.json">` but VitePWA generates `dist/manifest.webmanifest`. In production (Vercel) the service worker intercepts the request correctly. In `npm run dev` mode the `/manifest.json` request will 404 — this produces a browser warning but does not affect functionality.
