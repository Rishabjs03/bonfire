export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Frame-rate independent lerp factor. */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt)

/** Lerp between two angles along the shortest path. */
export function lerpAngle(from: number, to: number, t: number) {
  let diff = (to - from) % (Math.PI * 2)
  if (diff > Math.PI) diff -= Math.PI * 2
  if (diff < -Math.PI) diff += Math.PI * 2
  return from + diff * t
}
