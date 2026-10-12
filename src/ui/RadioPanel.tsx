import { useEffect, useState } from 'react'
import { countClick, parseMusicLink, searchStations, suggestedStations, type Station } from '../audio/music'
import { useRadioStore } from '../store/radioStore'

function StationList({ stations, onPick, playingUrl }: { stations: Station[]; onPick: (s: Station) => void; playingUrl?: string }) {
  if (stations.length === 0) return <p className="px-2 py-8 text-center text-[13px] text-ink-faint">Nothing on that frequency.</p>
  return (
    <ul className="space-y-0.5">
      {stations.map((s) => {
        const active = playingUrl === s.url
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${active ? 'bg-ember/12' : 'hover:bg-ink/[0.06]'}`}
            >
              <div className="min-w-0 flex-1">
                <div className={`truncate text-[13.5px] font-medium ${active ? 'text-ember' : 'text-ink'}`}>{s.name}</div>
                <div className="truncate text-[11.5px] text-ink-faint">
                  {[s.country, s.tags.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}
                </div>
              </div>
              {active ? (
                <span className="eq shrink-0" aria-label="Playing">
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                s.bitrate > 0 && <span className="tabular shrink-0 text-[11px] text-ink-faint">{s.bitrate}k</span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** The radio by the fire: search internet radio, or paste a Spotify / YouTube link. Plays only for you. */
export function RadioPanel() {
  const open = useRadioStore((s) => s.open)
  const setOpen = useRadioStore((s) => s.setOpen)
  const playing = useRadioStore((s) => s.playing)
  const play = useRadioStore((s) => s.play)
  const stop = useRadioStore((s) => s.stop)
  const volume = useRadioStore((s) => s.volume)
  const setVolume = useRadioStore((s) => s.setVolume)
  const error = useRadioStore((s) => s.error)
  const [tab, setTab] = useState<'stations' | 'links'>('stations')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Station[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState('')

  // suggestions first, then debounced search as you type
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const q = query.trim()
    const t = window.setTimeout(
      () => {
        setLoading(true)
        ;(q ? searchStations(q) : suggestedStations())
          .then((r) => !cancelled && setResults(r))
          .catch(() => !cancelled && setResults([]))
          .finally(() => !cancelled && setLoading(false))
      },
      q ? 380 : 0,
    )
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [query, open])

  if (!open) return null

  const pickStation = (s: Station) => {
    countClick(s.id)
    play({ kind: 'station', title: s.name, subtitle: [s.country, s.tags[0]].filter(Boolean).join(' · '), url: s.url })
  }
  const playLink = () => {
    const parsed = parseMusicLink(link)
    if (!parsed) {
      setLinkError('Paste a link to a Spotify track, album or playlist, or a YouTube video.')
      return
    }
    setLinkError('')
    play({ kind: parsed.kind, title: parsed.title, url: parsed.url })
  }

  return (
    <div className="panel absolute right-4 top-16 z-20 flex max-h-[min(620px,calc(100%-8rem))] w-[min(360px,calc(100%-2rem))] flex-col rounded-2xl text-ink">
      <div className="flex items-start justify-between px-5 pb-3 pt-4">
        <div>
          <p className="caption">Only you can hear it</p>
          <h2 className="mt-1 font-display text-[1.9rem] leading-none">The radio</h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close radio"
          className="-mr-1 grid h-8 w-8 place-items-center rounded-full text-ink-faint transition hover:bg-ink/10 hover:text-ink"
        >
          <svg viewBox="0 0 16 16" width="13" height="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </button>
      </div>
      <div className="mx-5 grid grid-cols-2 gap-1 rounded-full bg-ink/[0.06] p-1 text-[12.5px] font-medium" role="tablist">
        {(
          [
            ['stations', 'Stations'],
            ['links', 'Spotify / YouTube'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full py-1.5 transition ${tab === id ? 'bg-ink text-night' : 'text-ink-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'stations' ? (
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-4">
          <div className="relative mx-2">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stations or genres"
              className="h-10 w-full rounded-xl border border-ink/10 bg-black/25 pl-9 pr-3 text-[13.5px] text-ink outline-none transition placeholder:text-ink-faint focus:border-ember/60"
              autoFocus
            />
          </div>
          <p className="caption px-4 pb-1.5 pt-4">{loading ? 'Tuning…' : query ? 'Results' : 'For the evening'}</p>
          <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
            {results && <StationList stations={results} onPick={pickStation} playingUrl={playing?.url} />}
          </div>
        </div>
      ) : (
        <div className="px-5 pb-4 pt-4">
          <div className="flex gap-2">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && playLink()}
              placeholder="Paste a Spotify or YouTube link"
              className="h-10 min-w-0 flex-1 rounded-xl border border-ink/10 bg-black/25 px-3 text-[13.5px] text-ink outline-none transition placeholder:text-ink-faint focus:border-ember/60"
            />
            <button type="button" onClick={playLink} className="h-10 rounded-xl bg-ink px-4 text-[13px] font-semibold text-night transition hover:bg-white">
              Play
            </button>
          </div>
          {linkError && <p className="mt-2 text-[12px] text-rose-300/90">{linkError}</p>}
          <p className="mt-4 text-[12px] leading-relaxed text-ink-faint">
            Copy a link from{' '}
            <a className="text-ink-muted underline decoration-ink/30 underline-offset-2 hover:text-ink" href="https://open.spotify.com/search" target="_blank" rel="noreferrer">
              Spotify
            </a>{' '}
            or{' '}
            <a className="text-ink-muted underline decoration-ink/30 underline-offset-2 hover:text-ink" href="https://www.youtube.com/results?search_query=campfire+music" target="_blank" rel="noreferrer">
              YouTube
            </a>{' '}
            and paste it here. Spotify plays full songs when you’re logged in to it in this browser, otherwise 30-second previews.
          </p>
        </div>
      )}

      <div className="border-t border-ink/[0.07] px-5 pb-4 pt-3.5">
        {playing ? (
          <div className="flex items-center gap-3">
            <span className="eq shrink-0" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium text-ink">{playing.title}</div>
              {playing.subtitle && <div className="truncate text-[11.5px] text-ink-faint">{playing.subtitle}</div>}
            </div>
            {playing.kind !== 'station' && (
              <button
                type="button"
                onClick={() => useRadioStore.setState({ open: false, playerExpanded: true })}
                className="h-8 rounded-full px-3 text-[12px] font-medium text-ink-muted transition hover:bg-ink/10 hover:text-ink"
              >
                Player
              </button>
            )}
            <button
              type="button"
              onClick={stop}
              className="h-8 rounded-full border border-ink/15 px-3.5 text-[12px] font-medium text-ink transition hover:bg-ink/10"
            >
              Stop
            </button>
          </div>
        ) : (
          <div className="text-[13px] text-ink-faint">Nothing playing</div>
        )}
        {error && <p className="mt-2 text-[12px] text-rose-300/90">{error}</p>}
        <label className="mt-3.5 flex items-center gap-3">
          <span className="caption">Volume</span>
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="flex-1" />
        </label>
        <p className="mt-3 text-[10.5px] text-ink-faint">Stations from radio-browser.info</p>
      </div>
    </div>
  )
}

/**
 * Spotify / YouTube player. The iframe stays mounted for as long as music plays (so it keeps
 * playing); the card itself folds away into the radio control.
 */
export function EmbedPlayer() {
  const playing = useRadioStore((s) => s.playing)
  const expanded = useRadioStore((s) => s.playerExpanded)
  const panelOpen = useRadioStore((s) => s.open)
  const setExpanded = useRadioStore((s) => s.setPlayerExpanded)
  const stop = useRadioStore((s) => s.stop)
  if (!playing || playing.kind === 'station') return null
  const spotify = playing.kind === 'spotify'
  const visible = expanded && !panelOpen
  return (
    <div
      className={`panel absolute right-4 top-[6.75rem] z-20 w-[min(340px,calc(100%-2rem))] origin-top-right overflow-hidden rounded-2xl transition duration-300 ${
        visible ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
      }`}
      aria-hidden={!visible}
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <span className="caption whitespace-nowrap">{spotify ? 'Spotify' : 'YouTube'} · just for you</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="h-7 rounded-full px-2.5 text-[12px] font-medium text-ink-muted transition hover:bg-ink/10 hover:text-ink"
          >
            Hide
          </button>
          <button
            type="button"
            onClick={stop}
            className="h-7 rounded-full px-2.5 text-[12px] font-medium text-ink-muted transition hover:bg-ink/10 hover:text-ink"
          >
            Stop
          </button>
        </div>
      </div>
      <div className="px-2 pb-2">
        <iframe
          title={playing.title}
          src={playing.url}
          width="100%"
          height={spotify ? 152 : 182}
          className="block rounded-xl"
          style={{ border: 0 }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        />
      </div>
    </div>
  )
}

/**
 * The radio control (top right): shows what's playing, opens the radio when you're sitting on
 * a log or standing by it, and folds the Spotify / YouTube player in and out.
 */
export function RadioPrompt() {
  const near = useRadioStore((s) => s.near)
  const open = useRadioStore((s) => s.open)
  const playing = useRadioStore((s) => s.playing)
  const expanded = useRadioStore((s) => s.playerExpanded)
  const setOpen = useRadioStore((s) => s.setOpen)
  const setExpanded = useRadioStore((s) => s.setPlayerExpanded)
  if (open || (!near && !playing)) return null
  const embed = playing && playing.kind !== 'station'
  return (
    <div className="panel absolute right-4 top-16 z-10 flex items-center rounded-full text-[13px] font-medium text-ink">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 rounded-full py-2 pl-3.5 pr-3 transition hover:bg-ink/[0.07]"
        title={near ? 'Open the radio (R)' : 'Open the radio'}
      >
        {playing ? (
          <span className="eq" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        ) : (
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden className="text-ember">
            <rect x="1.5" y="5" width="13" height="9" rx="1.5" />
            <circle cx="5.5" cy="9.5" r="2" />
            <path d="M10 8.5h2.5M10 10.5h2.5M4 5l7-3.5" strokeLinecap="round" />
          </svg>
        )}
        <span className="max-w-[11rem] truncate">{playing ? playing.title : 'Radio'}</span>
        {near && <kbd className="kbd">R</kbd>}
      </button>
      {embed && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? 'Hide player' : 'Show player'}
          aria-expanded={expanded}
          className="mr-1 grid h-8 w-8 place-items-center rounded-full text-ink-muted transition hover:bg-ink/10 hover:text-ink"
        >
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      )}
    </div>
  )
}
