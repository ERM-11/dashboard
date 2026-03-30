import { useState, useEffect, useRef } from 'react'
// Dark-only dashboard — no light mode toggle
import { migrateStorage } from './utils/migrateStorage'
import ErrorBoundary from './components/ErrorBoundary'
import WeatherWidget from './components/WeatherWidget'
import PollenWidget from './components/PollenWidget'
import NewsWidget from './components/NewsWidget'
import WordWidget from './components/WordWidget'
import StockWidget from './components/StockWidget'
import GermanWidget from './components/GermanWidget'
import SunsetWidget from './components/SunsetWidget'
import CIMAWidget from './components/CIMAWidget'

// Run once at module load — before any useState initialiser reads localStorage
migrateStorage()

const DEFAULT_ORDER = ['weather', 'pollen', 'sunset', 'news', 'word', 'stocks', 'german', 'cima']

const WIDGETS = {
  weather: <WeatherWidget />,
  pollen:  <PollenWidget />,
  sunset:  <SunsetWidget />,
  news:    <NewsWidget />,
  word:    <WordWidget />,
  stocks:  <StockWidget />,
  german:  <GermanWidget />,
  cima:    <CIMAWidget />,
}

// Widgets that span more than one column on desktop
const WIDGET_SPAN = {
  cima: 'lg:col-span-2',
}

function loadOrder() {
  try {
    const stored = JSON.parse(localStorage.getItem('dashboard_widgetOrder') || 'null')
    // Accept stored order only if it contains all current widget IDs
    if (Array.isArray(stored) && DEFAULT_ORDER.every(id => stored.includes(id))) {
      // Add any new IDs that aren't yet in the stored order
      const missing = DEFAULT_ORDER.filter(id => !stored.includes(id))
      return [...stored, ...missing]
    }
  } catch { /* ignore */ }
  return DEFAULT_ORDER
}

export default function App() {
  const [now, setNow] = useState(new Date())
  const [order, setOrder] = useState(loadOrder)

  // DnD state — stored in refs to avoid re-renders during drag
  const dragSrc  = useRef(null)
  const dragOver = useRef(null)
  const [dropTarget, setDropTarget] = useState(null)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  function handleDragStart(e, idx) {
    dragSrc.current = idx
    e.dataTransfer.effectAllowed = 'move'
    e.currentTarget.style.opacity = '0.5'
  }

  function handleDragEnd(e) {
    e.currentTarget.style.opacity = ''
    setDropTarget(null)
    dragSrc.current  = null
    dragOver.current = null
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOver.current !== idx) {
      dragOver.current = idx
      setDropTarget(idx)
    }
  }

  function handleDrop(e, idx) {
    e.preventDefault()
    const src = dragSrc.current
    if (src === null || src === idx) return
    const next = [...order]
    const [moved] = next.splice(src, 1)
    next.splice(idx, 0, moved)
    setOrder(next)
    localStorage.setItem('dashboard_widgetOrder', JSON.stringify(next))
    setDropTarget(null)
    dragSrc.current  = null
    dragOver.current = null
  }

  const dateStr = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  return (
    <div className="min-h-screen bg-slate-950 transition-colors duration-300">

      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 shadow-lg">
        <div className="px-5 py-3 flex items-center justify-between max-w-[1600px] mx-auto">
          <h1 className="font-display font-bold text-slate-100 tracking-tight"
            style={{ fontSize: '1.2rem', letterSpacing: '-0.01em' }}>
            Ethan's Dashboard
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 hidden sm:flex items-center gap-2">
              <span>{dateStr}</span>
              <span className="text-slate-700">·</span>
              <span className="font-mono text-slate-300 tabular-nums">{timeStr}</span>
            </span>
          </div>
        </div>
        {/* Gradient accent line */}
        <div className="h-px"
          style={{ background: 'linear-gradient(90deg, #1e3a8a, #3b82f6 30%, #8b5cf6 60%, #f59e0b 85%, #f43f5e)' }} />
      </header>

      {/* Widget grid */}
      <main className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-[1600px] mx-auto">
        {order.map((id, idx) => (
          <div
            key={id}
            draggable
            onDragStart={e => handleDragStart(e, idx)}
            onDragEnd={handleDragEnd}
            onDragOver={e => handleDragOver(e, idx)}
            onDragLeave={() => {}}
            onDrop={e => handleDrop(e, idx)}
            className={`group relative rounded-xl transition-all duration-150 ${WIDGET_SPAN[id] || ''} ${
              dropTarget === idx ? 'ring-2 ring-blue-500/60 ring-offset-2 ring-offset-slate-950' : ''
            }`}
          >
            {/* Drag handle */}
            <div
              className="absolute top-2 right-2 z-10 hidden sm:flex items-center justify-center
                w-6 h-6 rounded cursor-grab active:cursor-grabbing
                text-slate-600 hover:text-slate-400 opacity-0 group-hover:opacity-100
                transition-opacity select-none"
              title="Drag to reorder"
              style={{ fontSize: '14px', lineHeight: 1 }}
            >
              ⠿
            </div>
            <ErrorBoundary>
              {WIDGETS[id]}
            </ErrorBoundary>
          </div>
        ))}
      </main>
    </div>
  )
}
