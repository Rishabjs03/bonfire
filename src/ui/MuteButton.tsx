import { useSyncExternalStore } from 'react'
import { audioEngine } from '../audio/audioEngine'

const subscribe = (fn: () => void) => audioEngine.onMuteChange(fn)
const getMuted = () => audioEngine.muted

export function MuteButton() {
  const muted = useSyncExternalStore(subscribe, getMuted)
  return (
    <button
      type="button"
      onClick={() => audioEngine.toggleMuted()}
      aria-label={muted ? 'Unmute sound (M)' : 'Mute sound (M)'}
      title={muted ? 'Unmute (M)' : 'Mute (M)'}
      className="panel absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full text-ink-muted transition hover:text-ink"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
        {muted ? (
          <path d="M16 9.5l5 5M21 9.5l-5 5" />
        ) : (
          <>
            <path d="M15.5 9a4 4 0 0 1 0 6" />
            <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
          </>
        )}
      </svg>
    </button>
  )
}
