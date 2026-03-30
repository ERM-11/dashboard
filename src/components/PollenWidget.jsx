import { LOCATION } from '../config'
import { useFetchData } from '../hooks/useFetchData'

const THRESHOLDS = {
  grass_pollen:    { low: 20, high: 80 },
  birch_pollen:    { low: 20, high: 80 },
  alder_pollen:    { low: 10, high: 50 },
  ragweed_pollen:  { low: 10, high: 50 },
  mugwort_pollen:  { low: 10, high: 50 },
}

const LABELS = {
  grass_pollen:   'Grass',
  birch_pollen:   'Birch',
  alder_pollen:   'Alder',
  ragweed_pollen: 'Ragweed',
  mugwort_pollen: 'Mugwort',
}

function getLevel(type, value) {
  if (value === null || value === undefined) return { level: 'N/A', color: 'bg-slate-600 text-slate-300' }
  const { low, high } = THRESHOLDS[type]
  if (value < low) return { level: 'Low', color: 'bg-green-700 text-green-100' }
  if (value < high) return { level: 'Medium', color: 'bg-amber-600 text-amber-100' }
  return { level: 'High', color: 'bg-red-700 text-red-100' }
}

function levelRank(level) {
  if (level === 'High') return 2
  if (level === 'Medium') return 1
  return 0
}

const REFRESH_INTERVAL = 15 * 60 * 1000

const POLLEN_API =
  `https://air-quality-api.open-meteo.com/v1/air-quality` +
  `?latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}` +
  `&current=grass_pollen,birch_pollen,alder_pollen,ragweed_pollen,mugwort_pollen`

export default function PollenWidget() {
  const { data, loading, error, lastUpdated, refresh: fetchData } = useFetchData(POLLEN_API, REFRESH_INTERVAL)

  const pollenTypes = Object.keys(THRESHOLDS)

  let overallLevel = null
  if (data?.current) {
    const levels = pollenTypes.map(t => getLevel(t, data.current[t]))
    overallLevel = levels.reduce((best, curr) =>
      levelRank(curr.level) > levelRank(best.level) ? curr : best
    )
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🌿</span>
          <h2 className="font-semibold text-slate-100">Edinburgh Pollen</h2>
        </div>
        <button
          onClick={fetchData}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          aria-label="Refresh pollen"
        >
          ↻
        </button>
      </div>

      {loading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-8 w-full" />
          ))}
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-red-400 text-sm">Failed to load pollen data</p>
          <button
            onClick={fetchData}
            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && data?.current && (
        <>
          {overallLevel && (
            <div className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2">
              <span className="text-sm font-semibold text-slate-200">Overall</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${overallLevel.color}`}>
                {overallLevel.level}
              </span>
            </div>
          )}
          <div className="space-y-1.5">
            {pollenTypes.map(type => {
              const value = data.current[type]
              const { level, color } = getLevel(type, value)
              return (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{LABELS[type]}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      {value !== null && value !== undefined ? value.toFixed(1) : '—'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
                      {level}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          {lastUpdated && (
            <p className="text-xs text-slate-500 text-right">
              Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </>
      )}
    </div>
  )
}
