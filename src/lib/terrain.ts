import { WORLD } from '../config'
import { world } from '../world/worldData'
import { smoothstep } from './math'

const { local, meta } = world()
const N = meta.local.n
const HALF = meta.local.half

function sampleGrid(x: number, z: number) {
  // row 0 is the north edge (z = -HALF), column 0 the west edge
  const fx = Math.min(N - 1.001, Math.max(0, ((x + HALF) / (2 * HALF)) * (N - 1)))
  const fy = Math.min(N - 1.001, Math.max(0, ((z + HALF) / (2 * HALF)) * (N - 1)))
  const ix = Math.floor(fx)
  const iy = Math.floor(fy)
  const ax = fx - ix
  const ay = fy - iy
  const i = iy * N + ix
  return (local[i] * (1 - ax) + local[i + 1] * ax) * (1 - ay) + (local[i + N] * (1 - ax) + local[i + N + 1] * ax) * ay
}

const PIT = sampleGrid(0, 0)

/**
 * Real ground height (metres, relative to the campfire) at local x (east) / z (south),
 * from swissALTI3D at 2 m, with a small level patch where the fire was built.
 */
export function heightAt(x: number, z: number) {
  const h = sampleGrid(x, z)
  const level = 1 - smoothstep(WORLD.firePitFlatten * 0.5, WORLD.firePitFlatten, Math.hypot(x, z))
  return h + (PIT - h) * level
}
