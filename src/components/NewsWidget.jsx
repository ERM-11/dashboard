import { useState, useEffect, useCallback } from 'react'

const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url='

const RSS_FEEDS = [
  { name: 'BBC Business',    url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { name: 'Reuters Business', url: 'https://feeds.reuters.com/reuters/businessNews' },
]

const FILTERS = {
  'All':           null,
  'EY / Big Four': ['ey', 'ernst young', 'ernst & young', 'deloitte', 'pwc', 'kpmg', 'big four', 'big 4'],
  'UK Banking':    ['bank', 'banking', 'hsbc', 'barclays', 'lloyds', 'natwest', 'nationwide', 'mortgage', 'lending'],
  'Fintech':       ['fintech', 'digital banking', 'neobank', 'payments', 'revolut', 'monzo', 'starling', 'klarna'],
  'Consulting':    ['consulting', 'advisory', 'management consulting', 'strategy'],
}

function itemMatchesFilter(item, keywords) {
  if (!keywords) return true
  const text = `${item.title} ${item.description}`.toLowerCase()
  return keywords.some(kw => text.includes(kw))
}

const REFRESH_INTERVAL = 30 * 60 * 1000

export default function NewsWidget() {
  const [allItems,    setAllItems]    = useState([])
  const [feedName,    setFeedName]    = useState('')
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [activeFilter, setActiveFilter] = useState(() =>
    localStorage.getItem('dashboard_newsFilter') || 'All'
  )
  const [expandedIdx, setExpandedIdx] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let items = [], usedFeed = ''
      for (const feed of RSS_FEEDS) {
        try {
          const res = await fetch(RSS2JSON + encodeURIComponent(feed.url))
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const json = await res.json()
          if (json.status !== 'ok' || !json.items?.length) throw new Error('Bad response')
          items = json.items
          usedFeed = feed.name
          break
        } catch (e) {
          console.error(`Feed ${feed.name} failed:`, e)
        }
      }
      if (items.length === 0) throw new Error('No RSS feeds available')
      setAllItems(items)
      setFeedName(usedFeed)
      setLastUpdated(new Date())
      setExpandedIdx(null)
    } catch (e) {
      console.error('News error:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [fetchData])

  function changeFilter(f) {
    setActiveFilter(f)
    localStorage.setItem('dashboard_newsFilter', f)
    setExpandedIdx(null)
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    } catch { return '' }
  }

  // Apply active filter, show up to 5
  const filteredItems = allItems
    .filter(item => itemMatchesFilter(item, FILTERS[activeFilter]))
    .slice(0, 5)

  const noResults = !loading && !error && allItems.length > 0 && filteredItems.length === 0

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📰</span>
          <h2 className="font-semibold text-slate-100">EY / FS News</h2>
        </div>
        <button onClick={fetchData}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          aria-label="Refresh news">↻</button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {Object.keys(FILTERS).map(f => (
          <button
            key={f}
            onClick={() => changeFilter(f)}
            className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
              activeFilter === f
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >{f}</button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-3 w-1/3" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-red-400 text-sm">Failed to load news</p>
          <button onClick={fetchData}
            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* No results for filter */}
      {noResults && (
        <div className="py-4 text-center">
          <p className="text-slate-400 text-sm">No matching headlines</p>
          <p className="text-slate-500 text-xs mt-1">Try a different filter or check back later</p>
        </div>
      )}

      {/* Headlines list */}
      {!loading && !error && filteredItems.length > 0 && (
        <div className="space-y-0">
          {filteredItems.map((item, idx) => {
            const isOpen = expandedIdx === idx
            const snippet = item.description
              ? item.description.replace(/<[^>]+>/g, '').slice(0, 220).trim()
              : null

            return (
              <div key={idx} className="border-b border-slate-700/50 last:border-0">
                {/* Compact headline row */}
                <button
                  className="w-full text-left py-2 flex items-start gap-2 hover:bg-slate-700/20 rounded transition-colors -mx-1 px-1"
                  onClick={() => setExpandedIdx(prev => prev === idx ? null : idx)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 leading-snug line-clamp-2">
                      {item.title}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-0.5 ml-1">
                    <span className="text-xs text-slate-500">{formatDate(item.pubDate)}</span>
                    <span className={`text-slate-500 transition-transform duration-200 text-xs ${isOpen ? 'rotate-180 inline-block' : ''}`}>
                      ▾
                    </span>
                  </div>
                </button>

                {/* Expandable description */}
                <div style={{
                  maxHeight: isOpen ? '120px' : '0',
                  overflow: 'hidden',
                  transition: 'max-height 0.2s ease',
                }}>
                  {isOpen && (
                    <div className="pb-2 px-1">
                      {snippet && (
                        <p className="text-xs text-slate-400 leading-relaxed mb-1.5">
                          {snippet}{snippet.length >= 220 ? '…' : ''}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">{feedName}</span>
                        {item.link && (
                          <a href={item.link} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            onClick={e => e.stopPropagation()}>
                            Read more →
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {lastUpdated && !loading && (
        <p className="text-xs text-slate-500 text-right -mt-1">
          Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}
