import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { isTouchDevice } from './isTouch'

const HINT_MS = 9000

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {keys.map((k) => (
        <kbd key={k} className="kbd">
          {k}
        </kbd>
      ))}
      <span className="text-ink-muted">{label}</span>
    </span>
  )
}

export function HUD() {
  const sitting = useGameStore((s) => s.sitting)
  const seated = useGameStore((s) => s.seated)
  const [hint, setHint] = useState(true)

  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), HINT_MS)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-7 flex flex-col items-center gap-4 px-4">
      <p className={`on-scene font-display text-[1.35rem] italic text-ink transition-opacity duration-1000 ${sitting ? 'opacity-90' : 'opacity-0'}`}>
        You’re warm now.
      </p>
      {!isTouchDevice && (
        <p className={`on-scene flex items-center gap-4 text-[12px] transition-opacity duration-1000 ${seated ? 'opacity-100' : 'opacity-0'}`}>
          <Hint keys={['F']} label="hold to roast a marshmallow" />
        </p>
      )}
      <div
        className={`panel flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-full px-4 py-2 text-[12px] transition-opacity duration-1000 ${
          hint ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {isTouchDevice ? (
          <span className="text-ink-muted">Thumbstick to walk · drag to look around · sit on a log by the fire</span>
        ) : (
          <>
            <Hint keys={['W', 'A', 'S', 'D']} label="Walk" />
            <Hint keys={['⇧', 'W']} label="Sprint" />
            <span className="text-ink-muted">Two-finger swipe to look · pinch to zoom</span>
            <Hint keys={['↵']} label="Chat" />
            <Hint keys={['1-5']} label="Emotes" />
            <Hint keys={['M']} label="Mute" />
          </>
        )}
      </div>
    </div>
  )
}
