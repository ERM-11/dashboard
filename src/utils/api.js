const CORS_PROXY = 'https://api.allorigins.win/raw?url='

export async function fetchWithFallback(url, options = {}) {
  try {
    const res = await fetch(url, options)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res
  } catch {
    const res = await fetch(CORS_PROXY + encodeURIComponent(url), options)
    if (!res.ok) throw new Error(`HTTP ${res.status} (proxy)`)
    return res
  }
}

export async function fetchJSON(url) {
  const res = await fetchWithFallback(url)
  return res.json()
}

export async function fetchText(url) {
  const res = await fetchWithFallback(url)
  return res.text()
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatTime(date = new Date()) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
