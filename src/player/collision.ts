import type { Vector3 } from 'three'
import { FIRE, TREES, WORLD } from '../config'
import { FOREST } from '../lib/forest'

interface Circle {
  x: number
  z: number
  r: number
}

const OBSTACLES: Circle[] = [
  { x: 0, z: 0, r: FIRE.collisionRadius },
  ...FOREST.map((t) => ({ x: t.x, z: t.z, r: TREES.trunkRadius * t.scale })),
]

/** Push a circle at `pos` (xz plane) out of trees and the fire, and softly back inside the world. */
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
