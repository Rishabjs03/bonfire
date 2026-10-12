import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { isTouchDevice } from './isTouch'

const HINT_MS = 8000

export function HUD() {
  const sitting = useGameStore((s) => s.sitting)
  const [hint, setHint] = useState(true)

  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), HINT_MS)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-8 flex flex-col items-center gap-3 font-serif tracking-wide">
      <p className={`text-xs text-stone-300/70 transition-opacity duration-1000 ${hint ? 'opacity-100' : 'opacity-0'}`}>
        {isTouchDevice
          ? 'joystick to walk · drag to look around · 💬 to chat'
          : 'WASD to walk · drag or Q/E to look · Enter to chat · 1–4 emotes · M to mute'}
      </p>
      <p className={`text-sm text-amber-100/70 transition-opacity duration-1000 ${sitting ? 'opacity-100' : 'opacity-0'}`}>
        you're warm now ✦
      </p>
    </div>
  )
}
