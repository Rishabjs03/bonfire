import { useEffect } from 'react'

/** Live input state, read every frame by the player and camera. */
const pressed = new Set<string>()

/** Analog input from the on-screen joystick (x: right, y: forward), -1..1. */
export const joystick = { x: 0, y: 0 }

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

const MOVE_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE',
])

/** Attach global keyboard listeners. Mount once near the root. */
export function useKeyboardControls() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      pressed.add(e.code)
      if (MOVE_KEYS.has(e.code)) e.preventDefault()
    }
    const up = (e: KeyboardEvent) => pressed.delete(e.code)
    const clear = () => pressed.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])
}

/** Drop held keys, e.g. when the chat input takes focus. */
export const clearPressedKeys = () => pressed.clear()

const has = (...codes: string[]) => codes.some((c) => pressed.has(c))

/** Writes the movement intent (x: right, y: forward), clamped to length 1, into `out`. */
export function readMoveInput(out: { x: number; y: number }) {
  let x = joystick.x
  let y = joystick.y
  if (has('KeyW', 'ArrowUp')) y += 1
  if (has('KeyS', 'ArrowDown')) y -= 1
  if (has('KeyD', 'ArrowRight')) x += 1
  if (has('KeyA', 'ArrowLeft')) x -= 1
  const len = Math.hypot(x, y)
  if (len > 1) {
    x /= len
    y /= len
  }
  out.x = x
  out.y = y
}

export const isSlowHeld = () => has('ShiftLeft', 'ShiftRight')

/** Camera orbit from Q/E: -1, 0 or 1. */
export const readOrbitInput = () => (has('KeyQ') ? 1 : 0) - (has('KeyE') ? 1 : 0)
