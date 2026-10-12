import { SIT_BACK_OFFSET } from '../player/people'
import { VIEW_DIR } from '../world/directions'

/** Log benches around the fire: left, behind and right of the view to the Matterhorn. */
export interface Bench {
  x: number
  z: number
  /** Unit tangent along the log. */
  tx: number
  tz: number
  length: number
  radius: number
}

export interface Seat {
  id: number
  /** Where the character's origin goes while seated (hips land on the log). */
  x: number
  z: number
  rotY: number
}

const BENCH_RADIUS = 2.9
const viewAngle = Math.atan2(VIEW_DIR.x, VIEW_DIR.z)

export const BENCHES: Bench[] = [Math.PI / 2, Math.PI, -Math.PI / 2].map((offset) => {
  const a = viewAngle + offset
  const x = Math.sin(a) * BENCH_RADIUS
  const z = Math.cos(a) * BENCH_RADIUS
  return { x, z, tx: Math.cos(a), tz: -Math.sin(a), length: 2.7, radius: 0.24 }
})

export const SEATS: Seat[] = BENCHES.flatMap((b, i) => {
  const len = Math.hypot(b.x, b.z)
  const fx = -b.x / len // facing the fire
  const fz = -b.z / len
  return [-0.85, 0, 0.85].map((off, k) => ({
    id: i * 3 + k,
    x: b.x + b.tx * off + fx * SIT_BACK_OFFSET,
    z: b.z + b.tz * off + fz * SIT_BACK_OFFSET,
    rotY: Math.atan2(fx, fz),
  }))
})

/**
 * The radio sits on its own stump beside the back bench, out of the smoke and in view
 * of every seat. Anyone sitting on a log can use it.
 */
export const RADIO = (() => {
  const b = BENCHES[1]
  const len = Math.hypot(b.x, b.z)
  const out = 0.55 // a little further from the fire than the bench
  const x = b.x + b.tx * (b.length / 2 + 0.95) + (b.x / len) * out
  const z = b.z + b.tz * (b.length / 2 + 0.95) + (b.z / len) * out
  return { x, z, rotY: Math.atan2(-x, -z), reach: 2.3 }
})()

/** A cord of split firewood stacked behind the left bench. */
export const WOODPILE = (() => {
  const a = viewAngle + Math.PI * 0.72
  return { x: Math.sin(a) * 5.4, z: Math.cos(a) * 5.4, rotY: a }
})()
