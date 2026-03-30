import { useState, useEffect, useCallback, useRef } from 'react'

const DEFAULT_TICKERS = ['NVDA', 'GOOGL', 'AMZN', 'AVGO', 'AMD', 'SOFI', 'PLTR', 'NVO']
const REFRESH_INTERVAL = 5 * 60 * 1000
const STAGGER_MS = 400

const RANGES = [
  { label: '1D', range: '1d',  interval: '5m'              },
  { label: '3D', range: '5d',  interval: '1h',  cutoffDays: 3 },
  { label: '1W', range: '5d',  interval: '1h'               },
  { label: '1M', range: '1mo', interval: '1d'               },
]

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), ms))])
}

async function fetchChart(ticker, range, interval) {
  const endpoint = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=${interval}`
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(endpoint)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}`,
  ]
  for (const url of proxies) {
    try {
      const res = await withTimeout(fetch(url), 10000)
      if (!res.ok) continue
      const json = await res.json()
      const result = json?.chart?.result?.[0]
      if (!result) continue
      const ts   = result.timestamp || []
      const q    = result.indicators?.quote?.[0] || {}
      const close = q.close  || []
      const open  = q.open   || []
      const high  = q.high   || []
      const low   = q.low    || []
      const vol   = q.volume || []
      const idxs = close.map((c, i) => c != null ? i : -1).filter(i => i >= 0)
      if (idxs.length < 2) continue  // empty / market-closed — try next proxy
      return {
        timestamps: idxs.map(i => ts[i]),
        prices:  idxs.map(i => close[i]),
        opens:   idxs.map(i => open[i]),
        highs:   idxs.map(i => high[i]),
        lows:    idxs.map(i => low[i]),
        volumes: idxs.map(i => vol[i]),
        meta:    result.meta || {},
      }
    } catch (e) {
      console.warn(`fetchChart ${ticker} ${range}:`, e.message)
    }
  }
  const noDataMsg = range === '1d' ? 'No intraday data — market may be closed' : `No data for ${ticker} ${range}`
  throw new Error(noDataMsg)
}

async function fetchTickerSummary(ticker) {
  // 5d/1h: always has data (no market-hours-only gap), ~8 pts/day → last 8 ≈ last trading day
  const data = await fetchChart(ticker, '5d', '1h')
  const { prices, meta } = data
  const cur       = meta.regularMarketPrice ?? prices.at(-1) ?? 0
  const prevClose = meta.chartPreviousClose ?? prices.at(-2) ?? cur
  const chg       = cur - prevClose
  const chgPct    = prevClose !== 0 ? (chg / prevClose) * 100 : 0
  return { ticker, price: cur, change: chg, changePct: chgPct, sparkline: prices.slice(-8) }
}

async function fetchTickerWithRetry(ticker) {
  try {
    return await fetchTickerSummary(ticker)
  } catch (e) {
    await new Promise(r => setTimeout(r, 1500))
    return await fetchTickerSummary(ticker) // throws if still fails
  }
}


// ── Sparkline (compact list view) ──────────────────────────────────────────
function Sparkline({ values }) {
  if (!values || values.length < 2) return <span className="text-xs text-slate-600">—</span>
  const mn = Math.min(...values), mx = Math.max(...values)
  const rng = mx - mn || 1
  const W = 56, H = 22
  const pts = values.map((v, i) =>
    `${((i / (values.length - 1)) * W).toFixed(1)},${(H - ((v - mn) / rng) * (H - 2) - 1).toFixed(1)}`
  ).join(' ')
  const up = values.at(-1) >= values[0]
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={up ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── Chevron icon ────────────────────────────────────────────────────────────
function Chevron({ open }) {
  return (
    <svg className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2">
      <path d="M2 4L6 8L10 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Detail chart (expanded view) ────────────────────────────────────────────
function DetailChart({ ticker, chartCache, setChartCache }) {
  const [range,   setRange]   = useState('1M')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [hoverIdx, setHoverIdx] = useState(null)
  const svgRef = useRef(null)

  const cfg      = RANGES.find(r => r.label === range) || RANGES[2]
  const cacheKey = `${ticker}-${range}`
  const data     = chartCache[cacheKey] || null

  useEffect(() => {
    if (chartCache[cacheKey]) { setError(null); return }
    setLoading(true)
    setError(null)
    setHoverIdx(null)
    fetchChart(ticker, cfg.range, cfg.interval)
      .then(d => setChartCache(prev => ({ ...prev, [cacheKey]: d })))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [ticker, range]) // eslint-disable-line

  // SVG layout constants
  const VW = 420, VH = 185
  const PAD = { left: 54, right: 12, top: 8, bottom: 26 }
  const plotW = VW - PAD.left - PAD.right
  const plotH = VH - PAD.top  - PAD.bottom

  // Apply cutoffDays filter for ranges like 3D that reuse a wider fetch
  const viewData = (() => {
    if (!data) return null
    if (!cfg.cutoffDays) return data
    const cutoff = (data.timestamps.at(-1) ?? 0) - cfg.cutoffDays * 86400
    const idxs = data.timestamps.map((t, i) => t >= cutoff ? i : -1).filter(i => i >= 0)
    if (idxs.length < 2) return data // not enough data after filter — show all
    return {
      timestamps: idxs.map(i => data.timestamps[i]),
      prices:     idxs.map(i => data.prices[i]),
      opens:      idxs.map(i => data.opens[i]),
      highs:      idxs.map(i => data.highs[i]),
      lows:       idxs.map(i => data.lows[i]),
      volumes:    idxs.map(i => data.volumes[i]),
      meta:       data.meta,
    }
  })()

  function onMouseMove(e) {
    if (!viewData || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const svgX  = ((e.clientX - rect.left) / rect.width) * VW
    const ratio = (svgX - PAD.left) / plotW
    const idx   = Math.round(ratio * (viewData.prices.length - 1))
    setHoverIdx(Math.max(0, Math.min(viewData.prices.length - 1, idx)))
  }

  function fmtX(ts) {
    if (!ts) return ''
    const d = new Date(ts * 1000)
    if (range === '1D') return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    if (range === '3D' || range === '1W') return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  function fmtTip(ts) {
    if (!ts) return ''
    const d = new Date(ts * 1000)
    if (range === '1D' || range === '3D' || range === '1W') {
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
             ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
  }

  function fmtP(p) {
    if (p == null) return '—'
    if (p >= 1000) return `$${p.toFixed(0)}`
    if (p >= 100)  return `$${p.toFixed(1)}`
    return `$${p.toFixed(2)}`
  }

  function fmtVol(v) {
    if (!v) return '—'
    if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B'
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
    if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K'
    return v.toString()
  }

  return (
    <div className="border-t border-slate-700/50 pt-2 pb-1">
      {/* Range buttons */}
      <div className="flex gap-1 mb-2">
        {RANGES.map(r => (
          <button key={r.label}
            onClick={() => { setRange(r.label); setHoverIdx(null) }}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              range === r.label
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700/60 text-slate-400 hover:text-slate-200'
            }`}
          >{r.label}</button>
        ))}
      </div>

      {loading && <div className="skeleton h-40 w-full rounded" />}
      {error   && <p className="text-xs text-red-400 py-2 text-center">Chart unavailable — {error}</p>}

      {!loading && !error && viewData && viewData.prices.length > 1 && (() => {
        const { prices, timestamps, opens, highs, lows, volumes } = viewData
        const mnP = Math.min(...prices), mxP = Math.max(...prices)
        const rng = mxP - mnP || 1
        const xOf = i => PAD.left + (i / (prices.length - 1)) * plotW
        const yOf = p => PAD.top  + plotH - ((p - mnP) / rng) * plotH
        const isUp = prices.at(-1) >= prices[0]
        const lineClr = isUp ? '#22c55e' : '#ef4444'
        const fillClr = isUp ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)'

        const polyPts = prices.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p).toFixed(1)}`).join(' ')
        const areaPath =
          `M${xOf(0).toFixed(1)},${yOf(prices[0]).toFixed(1)} ` +
          prices.map((p, i) => `L${xOf(i).toFixed(1)},${yOf(p).toFixed(1)}`).join(' ') +
          ` L${xOf(prices.length - 1).toFixed(1)},${(PAD.top + plotH).toFixed(1)}` +
          ` L${xOf(0).toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`

        const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => {
          const p = mnP + t * rng
          return { p, yv: yOf(p) }
        })
        const xTicks = Array.from({ length: 5 }, (_, i) => {
          const idx = Math.round((i / 4) * (prices.length - 1))
          return { xv: xOf(idx), ts: timestamps[idx] }
        })

        const hx = hoverIdx !== null ? xOf(hoverIdx) : null
        const hp = hoverIdx !== null ? prices[hoverIdx] : null
        const ht = hoverIdx !== null ? timestamps[hoverIdx] : null

        const validH = highs.filter(v => v != null)
        const validL = lows.filter(v => v != null)
        const openP  = opens.find(v => v != null)
        const highP  = validH.length ? Math.max(...validH) : null
        const lowP   = validL.length ? Math.min(...validL) : null
        const totVol = volumes.reduce((a, v) => a + (v || 0), 0)

        return (
          <>
            <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} className="w-full"
              style={{ height: '152px' }}
              onMouseMove={onMouseMove} onMouseLeave={() => setHoverIdx(null)}>
              {/* Grid lines */}
              {yTicks.map((t, i) => (
                <line key={i} x1={PAD.left} y1={t.yv.toFixed(1)} x2={PAD.left + plotW} y2={t.yv.toFixed(1)}
                  stroke="#1e3a5f" strokeWidth="0.5" />
              ))}
              {/* Y-axis labels */}
              {yTicks.map((t, i) => (
                <text key={i} x={PAD.left - 4} y={(t.yv + 3.5).toFixed(1)}
                  textAnchor="end" fontSize="9" fill="#64748b">{fmtP(t.p)}</text>
              ))}
              {/* X-axis labels */}
              {xTicks.map((t, i) => (
                <text key={i} x={t.xv.toFixed(1)} y={VH - 4}
                  textAnchor="middle" fontSize="9" fill="#64748b">{fmtX(t.ts)}</text>
              ))}
              {/* Area fill */}
              <path d={areaPath} fill={fillClr} />
              {/* Price line */}
              <polyline points={polyPts} fill="none" stroke={lineClr}
                strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
              {/* Crosshair */}
              {hx !== null && (
                <>
                  <line x1={hx.toFixed(1)} y1={PAD.top} x2={hx.toFixed(1)} y2={PAD.top + plotH}
                    stroke="#475569" strokeWidth="1" strokeDasharray="3,2" />
                  <circle cx={hx.toFixed(1)} cy={yOf(hp).toFixed(1)} r="3"
                    fill={lineClr} stroke="#1e293b" strokeWidth="1.5" />
                </>
              )}
              {/* Tooltip */}
              {hx !== null && hp !== null && (() => {
                const tx = hx > VW - 130 ? hx - 116 : hx + 8
                return (
                  <g>
                    <rect x={tx.toFixed(1)} y={PAD.top + 2} width="108" height="32"
                      rx="4" fill="#0f172a" stroke="#334155" strokeWidth="0.5" />
                    <text x={(tx + 6).toFixed(1)} y={PAD.top + 15}
                      fontSize="10.5" fill="#e2e8f0" fontWeight="bold">{fmtP(hp)}</text>
                    <text x={(tx + 6).toFixed(1)} y={PAD.top + 27}
                      fontSize="8.5" fill="#94a3b8">{fmtTip(ht)}</text>
                  </g>
                )
              })()}
            </svg>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {[
                { label: 'Open',   val: fmtP(openP) },
                { label: 'High',   val: fmtP(highP) },
                { label: 'Low',    val: fmtP(lowP) },
                { label: 'Volume', val: fmtVol(totVol) },
              ].map(({ label, val }) => (
                <div key={label} className="bg-slate-700/40 rounded-lg px-2 py-1.5 text-center">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="text-xs font-mono font-semibold text-slate-200 mt-0.5">{val}</div>
                </div>
              ))}
            </div>
          </>
        )
      })()}
    </div>
  )
}

// ── Main widget ─────────────────────────────────────────────────────────────
export default function StockWidget() {
  const [tickers, setTickers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dashboard_stockTickers') || 'null') || DEFAULT_TICKERS }
    catch { return DEFAULT_TICKERS }
  })
  const [stocks,         setStocks]         = useState([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const [lastUpdated,    setLastUpdated]    = useState(null)
  const [newTicker,      setNewTicker]      = useState('')
  const [sortMode,       setSortMode]       = useState('pct')
  const [expandedTicker, setExpandedTicker] = useState(null)
  const [chartCache,     setChartCache]     = useState({})

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    setStocks([])
    const acc = []
    for (let i = 0; i < tickers.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, STAGGER_MS))
      try {
        acc.push(await fetchTickerWithRetry(tickers[i]))
      } catch (e) {
        console.error(`Stock failed for ${tickers[i]}:`, e.message)
        acc.push({ ticker: tickers[i], price: null, change: null, changePct: null, sparkline: [], error: true })
      }
      setStocks([...acc]) // progressive render — each stock appears as it loads
    }
    setLastUpdated(new Date())
    setLoading(false)
  }, [tickers])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [fetchAll])

  function addTicker() {
    const t = newTicker.trim().toUpperCase()
    if (!t || tickers.includes(t)) { setNewTicker(''); return }
    const updated = [...tickers, t]
    setTickers(updated)
    localStorage.setItem('dashboard_stockTickers', JSON.stringify(updated))
    setNewTicker('')
  }

  function removeTicker(t) {
    const updated = tickers.filter(x => x !== t)
    setTickers(updated)
    localStorage.setItem('dashboard_stockTickers', JSON.stringify(updated))
    if (expandedTicker === t) setExpandedTicker(null)
  }

  function toggleExpand(ticker) {
    setExpandedTicker(prev => prev === ticker ? null : ticker)
  }

  const sortedStocks = [...stocks].sort((a, b) => {
    if (sortMode === 'alpha') return a.ticker.localeCompare(b.ticker)
    if (a.changePct === null) return 1
    if (b.changePct === null) return -1
    return b.changePct - a.changePct
  })

  const loadedCount = stocks.filter(s => !s.error && s.price !== null).length

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📈</span>
          <h2 className="font-semibold text-slate-100">Stock Tracker</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortMode(s => s === 'pct' ? 'alpha' : 'pct')}
            className="text-xs text-slate-400 hover:text-slate-300 border border-slate-600 rounded px-1.5 py-0.5 transition-colors"
          >{sortMode === 'pct' ? '% ↓' : 'A–Z'}</button>
          <button
            onClick={fetchAll} disabled={loading}
            className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 transition-colors"
          >{loading ? '…' : '↻'}</button>
        </div>
      </div>

      {/* Initial load skeleton */}
      {loading && stocks.length === 0 && (
        <div className="space-y-2">
          {[...Array(tickers.length)].map((_, i) => <div key={i} className="skeleton h-8 w-full" />)}
        </div>
      )}

      {/* Error state */}
      {error && stocks.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-red-400 text-sm">Failed to load stock data</p>
          <p className="text-xs text-slate-500">{error}</p>
          <button onClick={fetchAll}
            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* Stock list */}
      {sortedStocks.length > 0 && (
        <div className="space-y-0.5">
          {loading && <p className="text-xs text-slate-500 mb-1">Refreshing…</p>}

          {sortedStocks.map(stock => {
            const isExpanded = expandedTicker === stock.ticker
            return (
              <div key={stock.ticker}>
                {/* Row */}
                <div
                  className="flex items-center gap-2 cursor-pointer hover:bg-slate-700/30 rounded px-1 -mx-1 py-0.5 transition-colors select-none"
                  onClick={() => toggleExpand(stock.ticker)}
                >
                  <button
                    onClick={e => { e.stopPropagation(); removeTicker(stock.ticker) }}
                    className="text-slate-600 hover:text-red-400 transition-colors text-xs leading-none flex-shrink-0"
                    aria-label={`Remove ${stock.ticker}`}
                  >✕</button>

                  <span className="w-12 font-mono font-bold text-slate-200 text-xs flex-shrink-0">
                    {stock.ticker}
                  </span>

                  {stock.error ? (
                    <span className="text-slate-500 text-xs italic flex-1">unavailable</span>
                  ) : (
                    <>
                      <span className="w-16 text-right font-mono text-xs text-slate-200 flex-shrink-0">
                        {stock.price !== null ? `$${stock.price.toFixed(2)}` : '—'}
                      </span>
                      <span className={`w-20 text-right text-xs font-medium flex-shrink-0 ${(stock.changePct ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stock.change !== null
                          ? `${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)} (${stock.changePct >= 0 ? '+' : ''}${stock.changePct.toFixed(2)}%)`
                          : '—'}
                      </span>
                      <div className="flex-1 flex justify-end">
                        <Sparkline values={stock.sparkline} />
                      </div>
                    </>
                  )}

                  <span className={`text-slate-500 transition-colors ${isExpanded ? 'text-blue-400' : ''}`}>
                    <Chevron open={isExpanded} />
                  </span>
                </div>

                {/* Expandable detail panel */}
                <div style={{
                  maxHeight: isExpanded ? '400px' : '0',
                  overflow: 'hidden',
                  transition: 'max-height 0.3s ease',
                }}>
                  {isExpanded && (
                    <DetailChart
                      ticker={stock.ticker}
                      chartCache={chartCache}
                      setChartCache={setChartCache}
                    />
                  )}
                </div>
              </div>
            )
          })}

          {loadedCount < tickers.length && !loading && (
            <p className="text-xs text-amber-400 pt-1">
              {tickers.length - loadedCount} ticker(s) unavailable — try refreshing
            </p>
          )}
        </div>
      )}

      {/* Add ticker */}
      <div className="flex gap-2 pt-1 border-t border-slate-700">
        <input
          type="text"
          value={newTicker}
          onChange={e => setNewTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && addTicker()}
          placeholder="Add ticker…"
          className="flex-1 rounded-lg bg-slate-700 border border-slate-600 px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <button onClick={addTicker}
          className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors">
          Add
        </button>
      </div>

      {lastUpdated && (
        <p className="text-xs text-slate-500 text-right -mt-1">
          Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}
