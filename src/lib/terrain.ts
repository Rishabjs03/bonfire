import { VIEW_DIR, WORLD } from '../config'
import { smoothstep } from './math'

/**
 * Local ground height around camp (metres). A gentle shelf on the mountainside:
 * flat at the fire, softly bumpy snow, falling away toward the Matterhorn and
 * rising behind.
 */
export function heightAt(x: number, z: number) {
  const r = Math.hypot(x, z)
  const bumps =
    Math.sin(x * 0.11 + 0.4) * Math.cos(z * 0.09) +
    0.5 * Math.sin(x * 0.27 + 1.7) * Math.sin(z * 0.23 + 0.4) +
    0.22 * Math.sin(x * 0.61 + 0.3) * Math.cos(z * 0.57 + 2.1)
  const flatten = smoothstep(3.5, 11, r)

  const along = x * VIEW_DIR.x + z * VIEW_DIR.z
  const facing = r > 0.001 ? along / r : 0
  const wedge = smoothstep(0.25, 0.75, facing)
  const fall = Math.max(0, along - WORLD.viewSlopeStart)
  const rise = Math.max(0, -along - 18)

  return bumps * WORLD.groundBump * flatten - fall * fall * 0.0065 * wedge + rise * rise * 0.0042
}
