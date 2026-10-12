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
        className="absolute bottom-10 left-8 z-10 grid h-32 w-32 touch-none place-items-center rounded-full border border-amber-100/15 bg-black/20"
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
          className="h-12 w-12 rounded-full bg-amber-50/25 shadow-[0_0_12px_rgba(0,0,0,0.4)]"
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
              className="grid h-10 w-10 place-items-center rounded-full bg-black/30 text-lg"
            >
              {EMOTES[k].icon}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          aria-label="Chat"
          className="grid h-12 w-12 place-items-center rounded-full bg-black/35 text-xl"
        >
          💬
        </button>
      </div>
    </>
  )
}
