import { useState } from 'react'
import { LOCATION } from '../config'
import { useFetchData } from '../hooks/useFetchData'

const SUNSET_API =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}` +
  '&daily=sunset' +
  '&hourly=cloudcover,cloudcover_low,cloudcover_mid,cloudcover_high' +
  ',precipitation_probability,relative_humidity_2m,visibility,weathercode' +
  `&timezone=${encodeURIComponent(LOCATION.timezone)}` +
  '&forecast_days=5'

const WMO_CODES = {
  0:  { label: 'Clear sky',        icon: '☀️' },
  1:  { label: 'Mainly clear',     icon: '🌤️' },
  2:  { label: 'Partly cloudy',    icon: '⛅' },
  3:  { label: 'Overcast',         icon: '☁️' },
  45: { label: 'Foggy',            icon: '🌫️' },
  48: { label: 'Icy fog',          icon: '🌫️' },
  51: { label: 'Light drizzle',    icon: '🌦️' },
  53: { label: 'Drizzle',          icon: '🌦️' },
  55: { label: 'Dense drizzle',    icon: '🌧️' },
  61: { label: 'Slight rain',      icon: '🌧️' },
  63: { label: 'Moderate rain',    icon: '🌧️' },
  65: { label: 'Heavy rain',       icon: '🌧️' },
  71: { label: 'Slight snow',      icon: '🌨️' },
  73: { label: 'Moderate snow',    icon: '❄️' },
  75: { label: 'Heavy snow',       icon: '❄️' },
  80: { label: 'Showers',          icon: '🌦️' },
  81: { label: 'Mod. showers',     icon: '🌧️' },
  82: { label: 'Violent showers',  icon: '⛈️' },
  95: { label: 'Thunderstorm',     icon: '⛈️' },
  96: { label: 'Thunderstorm',     icon: '⛈️' },
  99: { label: 'Thunderstorm',     icon: '⛈️' },
}

function getWeather(code) {
  if (WMO_CODES[code]) return WMO_CODES[code]
  // Find closest lower code
  const keys = Object.keys(WMO_CODES).map(Number).sort((a, b) => a - b)
  let match = WMO_CODES[0]
  for (const k of keys) {
    if (code >= k) match = WMO_CODES[k]
  }
  return match
}

/**
 * Score the quality of a sunset 0–100.
 * Ported directly from sunset_notifier.py (sunset-tracker project).
 *
 * Positive contributions (max 55 pts):
 *   +35  mid-level cloud — Gaussian peaked at 40%, σ=20%
 *   +20  high cloud      — linear
 *
 * Penalties (up to −45 pts):
 *   −20  low cloud              — linear
 *   −10  humidity above 70%     — linear, full at 100%
 *   −10  precipitation prob >30% — hard penalty
 *   −5   visibility below 10 km — linear
 *
 * Raw range [−45, +55] shifted by +45 → [0, 100].
 */
function calcSunsetScore(cloudMid, cloudHigh, cloudLow, humidity, precipProb, visibilityM) {
  // Mid-level cloud: Gaussian peaked at 40%, σ=20%
  const midScore = Math.exp(-Math.pow(cloudMid - 40, 2) / (2 * Math.pow(20, 2)))
  let raw = 35.0 * midScore

  // High cloud: pure positive
  raw += 20.0 * (cloudHigh / 100.0)

  // Low cloud: penalty
  raw -= 20.0 * (cloudLow / 100.0)

  // Humidity penalty above 70%
  if (humidity > 70) {
    raw -= 10.0 * Math.min((humidity - 70.0) / 30.0, 1.0)
  }

  // Precipitation probability: hard penalty above 30%
  if (precipProb > 30) {
    raw -= 10.0
  }

  // Visibility penalty below 10 km
  const visKm = visibilityM / 1000.0
  if (visKm < 10.0) {
    raw -= 5.0 * (1.0 - visKm / 10.0)
  }

  // Shift [−45, 55] → [0, 100] and clamp
  return Math.max(0, Math.min(100, Math.round(raw + 45.0)))
}

function scoreLabel(score) {
  if (score >= 85) return 'Spectacular'
  if (score >= 70) return 'Great'
  if (score >= 55) return 'Good'
  if (score >= 40) return 'Decent'
  if (score >= 25) return 'Fair'
  return 'Poor'
}

function scoreColor(score) {
  if (score >= 85) return '#f59e0b'  // amber
  if (score >= 70) return '#fb923c'  // orange
  if (score >= 55) return '#fbbf24'  // yellow
  if (score >= 40) return '#a3a3a3'  // neutral
  return '#64748b'                   // slate — poor
}

function ScoreRing({ score, size = 48 }) {
  const cx = size / 2
  const radius = cx - 5
  const circ = 2 * Math.PI * radius
  const offset = circ * (1 - score / 100)
  const color = scoreColor(score)
  const trackColor = score >= 40 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.05)'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)', display: 'block' }}>
      <circle cx={cx} cy={cx} r={radius} fill="none" stroke={trackColor} strokeWidth="3.5" />
      <circle
        cx={cx} cy={cx} r={radius}
        fill="none" stroke={color} strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease' }}
      />
    </svg>
  )
}

function findHourlyIndex(hourlyTimes, sunsetISO) {
  if (!sunsetISO || !hourlyTimes?.length) return -1
  const sunsetHour = parseInt(sunsetISO.slice(11, 13))
  const sunsetDate = sunsetISO.slice(0, 10)
  return hourlyTimes.findIndex(t =>
    t.startsWith(sunsetDate) && parseInt(t.slice(11, 13)) === sunsetHour
  )
}

const REFRESH_INTERVAL = 30 * 60 * 1000

export default function SunsetWidget() {
  const { data, loading, error, lastUpdated, refresh: fetchData } = useFetchData(SUNSET_API, REFRESH_INTERVAL)
  const [selectedDay, setSelectedDay] = useState(null)

  const days = data ? data.daily.time.map((date, i) => {
    const sunsetISO = data.daily.sunset[i]
    const hIdx = findHourlyIndex(data.hourly.time, sunsetISO)

    const get = (arr, fallback) => (hIdx >= 0 && arr[hIdx] != null) ? arr[hIdx] : fallback
    const cloudTotal  = get(data.hourly.cloudcover, 50)
    const cloudLow    = get(data.hourly.cloudcover_low, 30)
    const cloudMid    = get(data.hourly.cloudcover_mid, 20)
    const cloudHigh   = get(data.hourly.cloudcover_high, 10)
    const precipProb  = get(data.hourly.precipitation_probability, 0)
    const humidity    = get(data.hourly.relative_humidity_2m, 70)
    const visibilityM = get(data.hourly.visibility, 10000)
    const wmo         = get(data.hourly.weathercode, 0)

    const score = calcSunsetScore(cloudMid, cloudHigh, cloudLow, humidity, precipProb, visibilityM)
    const sunsetTime = sunsetISO ? sunsetISO.slice(11, 16) : '--:--'
    const dayName   = i === 0 ? 'Today'
      : new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
    const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

    return { date, dayName, dateLabel, sunsetTime, score, cloudTotal, cloudLow, cloudMid, cloudHigh, precipProb, humidity, visibilityM, wmo }
  }) : []

  const bestDayIdx = days.length ? days.reduce((best, d, i) => d.score > days[best].score ? i : best, 0) : null

  return (
    <div className="rounded-xl border border-slate-700 shadow-lg overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #1a1f2e 0%, #1e1a2e 100%)' }}>

      {/* Sunset gradient accent bar */}
      <div className="h-px" style={{
        background: 'linear-gradient(90deg, #92400e, #b45309, #d97706, #f59e0b, #fb923c, #f43f5e)'
      }} />

      <div className="p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌇</span>
            <div>
              <h2 className="font-semibold text-slate-100 leading-tight">Edinburgh Sunsets</h2>
              <p className="text-xs text-slate-500 leading-tight">5-day quality forecast</p>
            </div>
          </div>
          <button onClick={fetchData}
            className="text-xs text-amber-500 hover:text-amber-400 transition-colors px-1"
            aria-label="Refresh sunset data">↻</button>
        </div>

        {loading && (
          <div className="grid grid-cols-5 gap-1.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-[88px] rounded-lg" />
            ))}
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <p className="text-red-400 text-sm">Failed to load sunset data</p>
            <button onClick={fetchData}
              className="px-3 py-1 rounded-lg text-white text-sm transition-colors"
              style={{ background: '#d97706' }}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && days.length > 0 && (
          <>
            {/* 5-day score row */}
            <div className="grid grid-cols-5 gap-1.5">
              {days.map((day, i) => {
                const isSelected = selectedDay === i
                const isBest = i === bestDayIdx
                const color = scoreColor(day.score)

                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDay(prev => prev === i ? null : i)}
                    className="flex flex-col items-center gap-1 rounded-lg p-2 text-center transition-all cursor-pointer relative"
                    style={{
                      background: isSelected
                        ? 'rgba(255,255,255,0.07)'
                        : 'rgba(255,255,255,0.03)',
                      border: isSelected
                        ? `1px solid ${color}40`
                        : '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {isBest && (
                      <span className="absolute -top-1 -right-1 text-[9px] leading-none bg-amber-500 text-black rounded-full px-1 py-0.5 font-bold">
                        best
                      </span>
                    )}
                    <span className="text-xs text-slate-400 font-medium">{day.dayName}</span>

                    {/* Score ring with number overlay */}
                    <div className="relative flex items-center justify-center" style={{ width: 48, height: 48 }}>
                      <ScoreRing score={day.score} size={48} />
                      <span className="absolute font-bold font-mono"
                        style={{ color, fontSize: '12px', lineHeight: 1 }}>
                        {day.score}
                      </span>
                    </div>

                    <span className="text-[10px] font-semibold leading-tight" style={{ color }}>
                      {scoreLabel(day.score)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{day.sunsetTime}</span>
                  </button>
                )
              })}
            </div>

            {/* Expanded detail panel */}
            <div style={{
              maxHeight: selectedDay !== null ? '220px' : '0',
              overflow: 'hidden',
              transition: 'max-height 0.3s ease',
            }}>
              {selectedDay !== null && (() => {
                const day = days[selectedDay]
                const weather = getWeather(day.wmo)
                const color = scoreColor(day.score)

                return (
                  <div className="pt-3 border-t border-white/5 space-y-3">
                    {/* Day summary row */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-slate-200">
                          {day.dayName === 'Today' ? 'Today' : `${day.dayName}, ${day.dateLabel}`}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          {scoreLabel(day.score)} conditions
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{weather.icon}</span>
                        <span>{weather.label}</span>
                        <span className="font-mono ml-1" style={{ color }}>🌇 {day.sunsetTime}</span>
                      </div>
                    </div>

                    {/* Cloud layer bars */}
                    <div className="space-y-2">
                      {[
                        { label: 'High cloud', value: day.cloudHigh, max: 100, color: '#f59e0b', note: 'catches light'  },
                        { label: 'Mid cloud',  value: day.cloudMid,  max: 100, color: '#fb923c', note: 'ideal at 40%'   },
                        { label: 'Low cloud',  value: day.cloudLow,  max: 100, color: '#94a3b8', note: 'blocks horizon' },
                      ].map(({ label, value, max, color: barColor, note }) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 w-20 shrink-0">{label}</span>
                          <div className="flex-1 rounded-full overflow-hidden"
                            style={{ height: '5px', background: 'rgba(255,255,255,0.06)' }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(value / max) * 100}%`,
                                background: barColor,
                                transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
                              }}
                            />
                          </div>
                          <span className="text-xs font-mono w-8 text-right" style={{ color: barColor }}>
                            {value}%
                          </span>
                          <span className="text-xs text-slate-600 hidden sm:block w-24 shrink-0">{note}</span>
                        </div>
                      ))}
                    </div>

                    {/* Humidity + visibility + precip */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {(() => {
                        const humColor = day.humidity > 85 ? '#f87171' : day.humidity > 70 ? '#fbbf24' : '#6ee7b7'
                        const visKm = (day.visibilityM / 1000).toFixed(0)
                        const visColor = day.visibilityM < 5000 ? '#f87171' : day.visibilityM < 10000 ? '#fbbf24' : '#6ee7b7'
                        return (
                          <>
                            <span className="text-xs text-slate-500">
                              Humidity <span className="font-mono" style={{ color: humColor }}>{day.humidity}%</span>
                            </span>
                            <span className="text-xs text-slate-500">
                              Visibility <span className="font-mono" style={{ color: visColor }}>{visKm} km</span>
                            </span>
                            {day.precipProb > 0 && (
                              <span className="text-xs text-slate-500">
                                Rain chance <span className="font-mono text-blue-400">{day.precipProb}%</span>
                              </span>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )
              })()}
            </div>

            {lastUpdated && (
              <p className="text-xs text-right" style={{ color: '#4b5563' }}>
                Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
