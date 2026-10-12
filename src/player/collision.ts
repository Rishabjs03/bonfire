import type { Vector3 } from 'three'
import { FIRE, WORLD } from '../config'
import { FOREST, trunkRadius } from '../lib/forest'
import { BENCHES, RADIO, WOODPILE } from '../lib/camp'
import { ROCKS } from '../lib/rocks'

interface Circle {
  x: number
  z: number
  r: number
}

const OBSTACLES: Circle[] = [
  { x: 0, z: 0, r: FIRE.collisionRadius },
  ...FOREST.map((t) => ({ x: t.x, z: t.z, r: trunkRadius(t.height) * 1.6 })),
  ...ROCKS.map((r) => ({ x: r.x, z: r.z, r: 0.55 * r.scale })),
  // log benches as a row of circles along each log
  ...BENCHES.flatMap((b) => [-1.1, -0.55, 0, 0.55, 1.1].map((o) => ({ x: b.x + b.tx * o, z: b.z + b.tz * o, r: b.radius + 0.05 }))),
  { x: RADIO.x, z: RADIO.z, r: 0.35 },
  ...[-0.6, 0, 0.6].map((o) => ({ x: WOODPILE.x + Math.cos(WOODPILE.rotY) * o, z: WOODPILE.z - Math.sin(WOODPILE.rotY) * o, r: 0.45 })),
]

/** Push a circle at `pos` (xz plane) out of trunks and the fire, and softly back inside the world. */
export function resolveCollisions(pos: Vector3, radius: number, dt: number) {
  for (let i = 0; i < OBSTACLES.length; i++) {
    const o = OBSTACLES[i]
    const dx = pos.x - o.x
    const dz = pos.z - o.z
    const min = o.r + radius
    const d2 = dx * dx + dz * dz
    if (d2 >= min * min) continue
    const d = Math.sqrt(d2) || 0.0001
    const push = (min - d) / d
    pos.x += dx * push
    pos.z += dz * push
  }

  const dist = Math.hypot(pos.x, pos.z)
  if (dist > WORLD.radius) {
    const over = dist - WORLD.radius
    const k = Math.min(1, WORLD.boundaryPush * dt)
    pos.x -= (pos.x / dist) * over * k
    pos.z -= (pos.z / dist) * over * k
  }
}
