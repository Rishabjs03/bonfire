import { CanvasTexture } from 'three'

let softDot: CanvasTexture | null = null

/** A soft round sprite used by snow and embers. Created once, shared. */
export function getSoftDotTexture() {
  if (softDot) return softDot
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.8)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  softDot = new CanvasTexture(canvas)
  return softDot
}
