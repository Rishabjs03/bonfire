/**
 * Music sources for the radio. Everything plays locally, on this machine only.
 * - Internet radio: the community Radio Browser directory (https://www.radio-browser.info),
 *   free, no key, CORS-enabled; tens of thousands of real stations.
 * - Spotify / YouTube: paste a link; it plays in their official embedded players
 *   (Spotify plays full tracks when you're logged in to Spotify in this browser).
 */
export interface Station {
  id: string
  name: string
  url: string
  country: string
  tags: string[]
  codec: string
  bitrate: number
}

const SERVERS = ['https://de1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info']

async function api<T>(path: string): Promise<T> {
  let lastError: unknown
  for (const server of SERVERS) {
    try {
      const res = await fetch(server + path, { headers: { Accept: 'application/json' } })
      if (res.ok) return (await res.json()) as T
      lastError = new Error(String(res.status))
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}

interface ApiStation {
  stationuuid: string
  name: string
  url_resolved: string
  country: string
  tags: string
  codec: string
  bitrate: number
  lastcheckok: number
}

const toStation = (s: ApiStation): Station => ({
  id: s.stationuuid,
  name: s.name.trim(),
  url: s.url_resolved,
  country: s.country,
  tags: s.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 4),
  codec: s.codec,
  bitrate: s.bitrate,
})

/** On an https page the browser only plays https streams; try upgrading http ones. */
export const playableUrl = (url: string) => (window.location.protocol === 'https:' ? url.replace(/^http:/, 'https:') : url)

const usable = (s: ApiStation) => s.lastcheckok === 1 && /^https?:/.test(s.url_resolved) && !/m3u8?$|pls$/i.test(s.url_resolved)

/** Search stations by name, falling back to genre tags (e.g. "lofi", "jazz", "swiss"). */
export async function searchStations(query: string): Promise<Station[]> {
  const q = encodeURIComponent(query.trim())
  const common = 'limit=40&hidebroken=true&order=votes&reverse=true'
  const [byName, byTag] = await Promise.all([
    api<ApiStation[]>(`/json/stations/search?name=${q}&${common}`),
    api<ApiStation[]>(`/json/stations/search?tag=${q}&${common}`),
  ])
  const seen = new Set<string>()
  return [...byName, ...byTag].filter((s) => usable(s) && !seen.has(s.stationuuid) && seen.add(s.stationuuid)).map(toStation).slice(0, 40)
}

/** A few good evening-by-the-fire picks to start with (Swiss public radio + chill). */
export async function suggestedStations(): Promise<Station[]> {
  const picks = await Promise.all(
    ['Radio Swiss Jazz', 'Radio Swiss Classic', 'Radio Swiss Pop', 'SRF 3'].map((n) =>
      api<ApiStation[]>(`/json/stations/search?name=${encodeURIComponent(n)}&limit=1&hidebroken=true&order=votes&reverse=true`).catch(() => []),
    ),
  )
  const lofi = await api<ApiStation[]>('/json/stations/search?tag=lofi&limit=6&hidebroken=true&order=votes&reverse=true').catch(() => [])
  return [...picks.flat(), ...lofi].filter(usable).map(toStation)
}

/** Tell the directory a station was played (their API asks clients to do this). */
export function countClick(id: string) {
  void api(`/json/url/${id}`).catch(() => undefined)
}

/** Turn a pasted Spotify or YouTube link into an embeddable player URL. */
export function parseMusicLink(raw: string): { kind: 'spotify' | 'youtube'; url: string; title: string } | null {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '')
  if (host === 'open.spotify.com') {
    const m = u.pathname.match(/\/(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/)
    if (m) return { kind: 'spotify', url: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator`, title: `Spotify ${m[1]}` }
  }
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1)
    if (/^[\w-]{6,}$/.test(id)) return { kind: 'youtube', url: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`, title: 'YouTube' }
  }
  if (host.endsWith('youtube.com')) {
    const list = u.searchParams.get('list')
    const v = u.searchParams.get('v') ?? u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]+)/)?.[1]
    if (v && /^[\w-]{6,}$/.test(v)) return { kind: 'youtube', url: `https://www.youtube-nocookie.com/embed/${v}?autoplay=1${list ? `&list=${list}` : ''}`, title: 'YouTube' }
    if (list && /^[\w-]+$/.test(list)) return { kind: 'youtube', url: `https://www.youtube-nocookie.com/embed/videoseries?list=${list}&autoplay=1`, title: 'YouTube playlist' }
  }
  return null
}
