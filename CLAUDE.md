# Dashboard Project

Personal single-page dashboard hub at `C:\Users\ethan\projects\dashboard\`.
React 18 + Vite 5 + Tailwind CSS 3. No backend — all client-side, localStorage persistence.
Dark mode default. Responsive grid: 3-col → 2-col → 1-col.

## Current Widgets
- **WeatherWidget** — Edinburgh 7-day forecast (Open-Meteo), clickable day cards → hourly breakdown
- **PollenWidget** — Edinburgh pollen (Open-Meteo Air Quality API)
- **SunsetWidget** — Edinburgh 5-day sunset quality score 0–100 (Open-Meteo hourly cloud/precip at sunset time)
- **NewsWidget** — BBC/Reuters RSS via rss2json.com, filter chips, expandable headlines
- **WordWidget** — 200-word vocab JSON, day-of-year deterministic, Learn/Quiz toggle
- **StockWidget** — Yahoo Finance, default tickers: NVDA/GOOGL/AMZN/AVGO/AMD/SOFI/PLTR/NVO
- **GermanWidget** — 100 fill-in-the-blank exercises, A2/B1/B2 levels, streak calendar

## Architecture

### Shared Utilities
- **`src/config.js`** — `LOCATION` object (`latitude`, `longitude`, `timezone`, `name`) — single source of truth for Edinburgh coordinates and timezone used by all three weather/environment widgets
- **`src/hooks/useFetchData.js`** — `useFetchData(url, refreshInterval)` — shared fetch hook used by WeatherWidget, PollenWidget, SunsetWidget. Returns `{ data, loading, error, lastUpdated, refresh }`
- **`src/utils/migrateStorage.js`** — `migrateStorage()` — one-time localStorage key migration from legacy names to `dashboard_` prefix. Called at module load in App.jsx before any useState initialiser
- **`src/utils/location.js`** — superseded by `src/config.js`, kept for reference but not imported anywhere
- **`src/components/ErrorBoundary.jsx`** — class-based error boundary wrapping each widget in App.jsx. Shows fallback card with "Reload Widget" button on crash; does not affect other widgets

### localStorage Keys (all `dashboard_` prefixed)
All keys now use `dashboard_` prefix. migrateStorage() handles one-time migration from legacy names on first load:
- `dashboard_darkMode` (was `darkMode`)
- `dashboard_wordStats` (was `wordStats`)
- `dashboard_wordVoteDate` (was `wordVoteDate`) — stores ISO date `YYYY-MM-DD`
- `dashboard_stockTickers` (was `stockTickers`)
- `dashboard_germanStats` (was `germanStats`)
- `dashboard_germanStreak` (was `germanStreak`) — `lastDate` stores ISO date `YYYY-MM-DD`
- `dashboard_quizStats` — quiz attempts/correct (was always prefixed)
- `dashboard_newsFilter` — active news filter
- `dashboard_germanLevel` — A2/B1/B2/All
- `dashboard_germanMistakes` — array of exercise IDs
- `dashboard_germanDates` — array of ISO dates completed
- `dashboard_widgetOrder` — array of widget IDs

## Key Technical Decisions

### Yahoo Finance
- **Only working unauthenticated endpoint:** `v8/finance/chart/{TICKER}?range=&interval=`
- `v7/finance/quote` returns 401 — do not use
- CORS proxies: `corsproxy.io` (primary), `api.allorigins.win` (fallback)
- Fetches are **sequential with 400ms gap** between tickers to avoid proxy rate limiting
- Failed tickers get one retry after 1.5s before being marked unavailable
- Summary data: `5d/1h` — gives sparkline of last ~trading day via `prices.slice(-8)`
- 24hr change: `meta.regularMarketChangePercent` is range-relative (NOT daily) — always compute manually as `(regularMarketPrice - chartPreviousClose) / chartPreviousClose`
- Chart ranges: `1D` (5m), `3D` (5d/1h filtered client-side), `1W` (5d/1h), `1M` (1mo/1d)

### RSS News
- `allorigins.win` + DOMParser approach fails silently for `<link>` tags in RSS XML
- Solution: `rss2json.com` API (1000 req/day free, no key needed for personal use)

### localStorage Keys
All localStorage keys use the `dashboard_` prefix. Migration from legacy keys is handled by `src/utils/migrateStorage.js` on app load.

### Widget Order
- Persisted to `dashboard_widgetOrder` as array of IDs
- HTML5 drag-and-drop with `⠿` handle (desktop only), dashed blue ring on drop target
- Default order: `['weather', 'pollen', 'sunset', 'news', 'word', 'stocks', 'german']`
- `loadOrder()` now gracefully merges stored order with DEFAULT_ORDER — new widget IDs appended if missing

## Data Files
- `src/data/vocabulary.json` — 248 business/finance English words (CLAUDE.md previously said 200 — audit found 248)
- `src/data/german-exercises.json` — 100 German exercises, IDs 1–100
  - IDs 1–30 = A2, 31–80 = B1, 81–100 = B2 (level assigned by ID, not in JSON)

See DASHBOARD_AUDIT.md for full codebase audit (note: some sections may be slightly out of date after the bug fixes applied post-audit).

## Expanding This Project
This dashboard is intended as a growing hub. When adding new widgets:
1. Create `src/components/XWidget.jsx`
2. Add the widget ID and component to `WIDGETS` and `DEFAULT_ORDER` in `App.jsx`
3. Use `dashboard_` prefix for any new localStorage keys
4. Follow the existing card style: `bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-4`
