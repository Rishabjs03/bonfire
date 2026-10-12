import { useRef, useState, type PointerEvent } from 'react'
import { joystick } from '../player/useControls'
import { useGameStore } from '../store/gameStore'
import { EMOTES, type EmoteKind } from '../store/socialStore'
import { sendEmote } from '../net/useMultiplayer'

const RADIUS = 52

/** On-screen controls for phones: a thumbstick, plus chat and emote buttons. */
export function TouchControls() {
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const origin = useRef<{ x: number; y: number; id: number } | null>(null)
  const setChatOpen = useGameStore((s) => s.setChatOpen)

  const move = (e: PointerEvent) => {
    const o = origin.current
    if (!o || o.id !== e.pointerId) return
    let dx = e.clientX - o.x
    let dy = e.clientY - o.y
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS
      dy = (dy / len) * RADIUS
    }
    setKnob({ x: dx, y: dy })
    joystick.x = dx / RADIUS
    joystick.y = -dy / RADIUS
  }
  const end = (e: PointerEvent) => {
    if (origin.current?.id !== e.pointerId) return
    origin.current = null
    setKnob({ x: 0, y: 0 })
    joystick.x = 0
    joystick.y = 0
  }

  return (
    <>
      <div
        className="panel absolute bottom-10 left-8 z-10 grid h-32 w-32 touch-none place-items-center rounded-full"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.pointerId }
          e.currentTarget.setPointerCapture(e.pointerId)
          move(e)
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        aria-label="Move"
        role="application"
      >
        <div
          className="h-12 w-12 rounded-full bg-ink/80 shadow-[0_4px_14px_rgb(0_0_0/0.45)]"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>
      <div className="absolute bottom-10 right-6 z-10 flex flex-col items-end gap-2">
        <div className="flex gap-1.5">
          {(Object.keys(EMOTES) as EmoteKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => sendEmote(k)}
              aria-label={EMOTES[k].label}
              className="panel grid h-10 w-10 place-items-center rounded-full text-lg"
            >
              {EMOTES[k].icon}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          aria-label="Chat"
          className="panel grid h-12 w-12 place-items-center rounded-full text-ink"
        >
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
            <path d="M3 4.5h14v9H8l-4 3v-3H3z" />
          </svg>
        </button>
      </div>
    </>
  )
}
