import { FOREST } from './forest'
import { createRng } from './random'

export interface RockInstance {
  x: number
  z: number
  scale: number
  rotation: number
  model: number
}

/** A few weathered gneiss boulders in the meadow, clear of trees and the fire. */
function placeRocks(): RockInstance[] {
  const rand = createRng(2024)
  const rocks: RockInstance[] = []
  let attempts = 0
  while (rocks.length < 18 && attempts++ < 2000) {
    const a = rand() * Math.PI * 2
    const r = 8 + rand() * 42
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    if (FOREST.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 9)) continue
    if (rocks.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < 16)) continue
    const big = rand() < 0.25
    rocks.push({ x, z, scale: big ? 1.1 + rand() * 0.8 : 0.3 + rand() * 0.5, rotation: rand() * Math.PI * 2, model: rand() < 0.5 ? 0 : 1 })
  }
  return rocks
}

export const ROCKS = placeRocks()
