import { useState } from 'react'
import { LOCATION } from '../config'
import { useFetchData } from '../hooks/useFetchData'

const WMO_CODES = {
  0:  { label: 'Clear sky',               icon: '☀️' },
  1:  { label: 'Mainly clear',            icon: '🌤️' },
  2:  { label: 'Partly cloudy',           icon: '⛅' },
  3:  { label: 'Overcast',               icon: '☁️' },
  45: { label: 'Foggy',                   icon: '🌫️' },
  48: { label: 'Icy fog',                 icon: '🌫️' },
  51: { label: 'Light drizzle',           icon: '🌦️' },
  53: { label: 'Moderate drizzle',        icon: '🌦️' },
  55: { label: 'Dense drizzle',           icon: '🌧️' },
  61: { label: 'Slight rain',             icon: '🌧️' },
  63: { label: 'Moderate rain',           icon: '🌧️' },
  65: { label: 'Heavy rain',              icon: '🌧️' },
  71: { label: 'Slight snow',             icon: '🌨️' },
  73: { label: 'Moderate snow',           icon: '❄️' },
  75: { label: 'Heavy snow',              icon: '❄️' },
  77: { label: 'Snow grains',             icon: '🌨️' },
  80: { label: 'Slight showers',          icon: '🌦️' },
  81: { label: 'Moderate showers',        icon: '🌧️' },
  82: { label: 'Violent showers',         icon: '⛈️' },
  85: { label: 'Slight snow showers',     icon: '🌨️' },
  86: { label: 'Heavy snow showers',      icon: '❄️' },
  95: { label: 'Thunderstorm',            icon: '⛈️' },
  96: { label: 'Thunderstorm w/ hail',    icon: '⛈️' },
  99: { label: 'Thunderstorm/heavy hail', icon: '⛈️' },
}

function getWeather(code) {
  return WMO_CODES[code] || { label: 'Unknown', icon: '🌡️' }
}

const REFRESH_INTERVAL = 15 * 60 * 1000

const API_URL =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}` +
  '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode' +
  '&hourly=temperature_2m,precipitation_probability,weathercode,windspeed_10m' +
  `&timezone=${encodeURIComponent(LOCATION.timezone)}`

export default function WeatherWidget() {
  const { data, loading, error, lastUpdated, refresh: fetchData } = useFetchData(API_URL, REFRESH_INTERVAL)
  const [selectedDay, setSelectedDay] = useState(null) // index 0-6 or null

  // Build hourly rows for a given daily date string (e.g. "2025-03-28")
  function getHourlyForDay(dateStr) {
    if (!data?.hourly) return []
    return data.hourly.time
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.startsWith(dateStr))
      // every 3 hours
      .filter((_, pos) => pos % 3 === 0)
      .map(({ t, i }) => ({
        time:    t.slice(11, 16), // "HH:MM"
        temp:    data.hourly.temperature_2m[i],
        precip:  data.hourly.precipitation_probability[i],
        code:    data.hourly.weathercode[i],
        wind:    data.hourly.windspeed_10m[i],
      }))
  }

  const hourlyRows = selectedDay !== null && data
    ? getHourlyForDay(data.daily.time[selectedDay])
    : []

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🌤️</span>
          <h2 className="font-semibold text-slate-100">Edinburgh Weather</h2>
        </div>
        <button onClick={fetchData}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          aria-label="Refresh weather">↻</button>
      </div>

      {loading && (
        <div className="space-y-2">
          {[...Array(7)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-red-400 text-sm">Failed to load weather data</p>
          <button onClick={fetchData}
            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* 7-day grid — each card is clickable */}
          <div className="grid grid-cols-7 gap-1">
            {data.daily.time.map((date, i) => {
              const weather   = getWeather(data.daily.weathercode[i])
              const dayName   = i === 0 ? 'Today' : new Date(date).toLocaleDateString('en-GB', { weekday: 'short' })
              const isSelected = selectedDay === i
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDay(prev => prev === i ? null : i)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-center transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600/30 border border-blue-500'
                      : 'bg-slate-700/50 border border-transparent hover:bg-slate-700'
                  }`}
                >
                  <span className="text-xs text-slate-400 font-medium">{dayName}</span>
                  <span className="text-xl leading-none" title={weather.label}>{weather.icon}</span>
                  <span className="text-xs font-semibold text-slate-100">
                    {Math.round(data.daily.temperature_2m_max[i])}°
                  </span>
                  <span className="text-xs text-slate-400">
                    {Math.round(data.daily.temperature_2m_min[i])}°
                  </span>
                  {data.daily.precipitation_sum[i] > 0 && (
                    <span className="text-xs text-blue-300">
                      💧{data.daily.precipitation_sum[i].toFixed(1)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Hourly panel — slides open below the grid */}
          <div style={{
            maxHeight: selectedDay !== null ? '200px' : '0',
            overflow: 'hidden',
            transition: 'max-height 0.3s ease',
          }}>
            {selectedDay !== null && hourlyRows.length > 0 && (
              <div className="border-t border-slate-700/50 pt-2">
                <p className="text-xs text-slate-400 mb-1.5">
                  Hourly —{' '}
                  {selectedDay === 0
                    ? 'Today'
                    : new Date(data.daily.time[selectedDay]).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                </p>
                {/* Horizontal scroll container with edge fades */}
                <div className="relative">
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {hourlyRows.map((h, idx) => {
                      const weather = getWeather(h.code)
                      return (
                        <div key={idx} className="flex flex-col items-center gap-0.5 flex-shrink-0
                          bg-slate-700/40 rounded-lg px-2 py-1.5 min-w-[52px] text-center">
                          <span className="text-xs text-slate-400">{h.time}</span>
                          <span className="text-base leading-none">{weather.icon}</span>
                          <span className="text-xs font-semibold text-slate-200">{Math.round(h.temp)}°</span>
                          <span className={`text-xs font-medium ${
                            (h.precip ?? 0) > 50 ? 'text-blue-400'
                            : (h.precip ?? 0) > 20 ? 'text-slate-300'
                            : 'text-slate-500'
                          }`}>{h.precip ?? 0}%</span>
                          {h.wind != null && (
                            <span className="text-xs text-slate-500">{Math.round(h.wind)}km</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {/* Edge fade indicators */}
                  <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-6
                    bg-gradient-to-l from-slate-800 to-transparent" />
                </div>
              </div>
            )}
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
