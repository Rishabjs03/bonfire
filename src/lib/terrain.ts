import { WORLD } from '../config'
import { smoothstep } from './math'

/** Ground height at a world position. Flat near the fire, gently bumpy in the forest, rising at the edges. */
export function heightAt(x: number, z: number) {
  const r = Math.hypot(x, z)
  const bumps =
    Math.sin(x * 0.13) * Math.cos(z * 0.11) +
    0.5 * Math.sin(x * 0.31 + 1.7) * Math.sin(z * 0.27 + 0.4) +
    0.25 * Math.sin(x * 0.71 + 0.3) * Math.cos(z * 0.63 + 2.1)
  const flatten = smoothstep(4, 12, r)
  const edge = Math.min(20, Math.max(0, r - WORLD.radius + 12))
  return bumps * WORLD.groundBump * flatten + edge * edge * 0.012
}
