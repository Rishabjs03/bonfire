import { DataTexture, FloatType, LinearFilter, NearestFilter, RedFormat, UnsignedByteType } from 'three'
import { FOREST } from '../lib/forest'
import { world } from './worldData'

const { meta, local } = world()
const N = meta.local.n
const HALF = meta.local.half

/** Local heights as a float texture (nearest; shaders interpolate manually). */
export const heightTexture = (() => {
  const t = new DataTexture(local, N, N, RedFormat, FloatType)
  t.minFilter = t.magFilter = NearestFilter
  t.flipY = false
  t.needsUpdate = true
  return t
})()

/** Canopy cover 0..1 over the local area (row 0 = north), from the real tree positions. */
export const canopyTexture = (() => {
  const size = 256
  const data = new Float32Array(size * size)
  const cell = (2 * HALF) / size
  for (const t of FOREST) {
    const crown = t.species === 'pine' ? 2.6 + t.height * 0.08 : 2 + t.height * 0.06
    const cx = (t.x + HALF) / cell
    const cy = (t.z + HALF) / cell
    const rad = Math.ceil((crown * 1.6) / cell)
    for (let y = Math.max(0, Math.floor(cy - rad)); y <= Math.min(size - 1, Math.ceil(cy + rad)); y++)
      for (let x = Math.max(0, Math.floor(cx - rad)); x <= Math.min(size - 1, Math.ceil(cx + rad)); x++) {
        const d = (Math.hypot(x - cx, y - cy) * cell) / crown
        data[y * size + x] += Math.exp(-d * d * 1.4)
      }
  }
  const bytes = new Uint8Array(size * size)
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.min(255, Math.round(Math.min(1, data[i]) * 255))
  const tex = new DataTexture(bytes, size, size, RedFormat, UnsignedByteType)
  tex.minFilter = tex.magFilter = LinearFilter
  tex.needsUpdate = true
  return tex
})()

/** GLSL: sample the local height (with the fire pit levelled) and canopy at world xz. */
export const GROUND_GLSL = /* glsl */ `
  uniform sampler2D uHeights;
  uniform sampler2D uCanopy;
  const float GROUND_HALF = ${HALF.toFixed(1)};
  const float GROUND_N = ${N.toFixed(1)};
  float rawHeight(vec2 xz) {
    vec2 f = clamp((xz + GROUND_HALF) / (2.0 * GROUND_HALF) * (GROUND_N - 1.0), 0.0, GROUND_N - 1.001);
    vec2 i = floor(f);
    vec2 a = f - i;
    float h00 = texelFetch(uHeights, ivec2(i), 0).r;
    float h10 = texelFetch(uHeights, ivec2(i) + ivec2(1, 0), 0).r;
    float h01 = texelFetch(uHeights, ivec2(i) + ivec2(0, 1), 0).r;
    float h11 = texelFetch(uHeights, ivec2(i) + ivec2(1, 1), 0).r;
    return mix(mix(h00, h10, a.x), mix(h01, h11, a.x), a.y);
  }
  float groundHeight(vec2 xz, float pit, float flatten) {
    float h = rawHeight(xz);
    float level = 1.0 - smoothstep(flatten * 0.5, flatten, length(xz));
    return mix(h, pit, level);
  }
  float canopy(vec2 xz) {
    return texture2D(uCanopy, (xz + GROUND_HALF) / (2.0 * GROUND_HALF)).r;
  }
`
