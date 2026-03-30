import { useState, useEffect, useCallback } from 'react'

/**
 * Shared data-fetching hook used by WeatherWidget, PollenWidget, and SunsetWidget.
 *
 * @param {string} url             - URL to fetch (must be stable / memoised by caller)
 * @param {number} refreshInterval - Auto-refresh interval in ms (0 / falsy = no auto-refresh)
 * @returns {{ data, loading, error, lastUpdated, refresh }}
 */
export function useFetchData(url, refreshInterval) {
  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date())
    } catch (e) {
      console.error(`[useFetchData] ${url}:`, e.message)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    refresh()
    if (!refreshInterval) return
    const id = setInterval(refresh, refreshInterval)
    return () => clearInterval(id)
  }, [refresh, refreshInterval])

  return { data, loading, error, lastUpdated, refresh }
}
