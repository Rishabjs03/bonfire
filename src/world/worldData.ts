/**
 * Baked real-world data for the camp at Riffelalp (see scripts/build-terrain.mjs):
 * swissALTI3D + Terrain Tiles elevation and SWISSIMAGE orthophoto (© swisstopo).
 * Loaded once before the app renders, then read synchronously everywhere.
 */
export interface WorldMeta {
  camp: { lat: number; lon: number }
  campAltitude: number
  r0: number
  rMax: number
  na: number
  nr: number
  heightScale: number
  local: { n: number; half: number }
  /** campHorizon: terrain elevation angle (°) toward the sun as seen from the fire. */
  sun: { bearing: number; elevation: number; campHorizon?: number }
  matterhorn: { east: number; north: number }
}

export interface WorldData {
  meta: WorldMeta
  /** Local heights relative to camp, row 0 = north edge. */
  local: Float32Array
  /** Polar terrain heights (×heightScale metres), ring-major. */
  polar: Uint16Array
  /** [x, y, z, scale] per tree in app coordinates (x = east, z = south). */
  treesLocal: Float32Array
  treesFar: Float32Array
}

import { TIME_OF_DAY } from '../config'

const BASE = '/assets/riffelalp/'
export const SUN_SHADOW_URL = BASE + (TIME_OF_DAY === 'sunrise' ? 'sunshadow_sunrise.png' : 'sunshadow.png')
let data: WorldData | null = null

async function bin(name: string) {
  const res = await fetch(BASE + name)
  if (!res.ok) throw new Error(`failed to load ${name}`)
  return res.arrayBuffer()
}

export async function loadWorldData() {
  if (data) return data
  const [metaRes, local, polar, treesLocal, treesFar] = await Promise.all([
    fetch(BASE + (TIME_OF_DAY === 'sunrise' ? 'meta_sunrise.json' : 'meta.json')).then((r) => r.json() as Promise<WorldMeta>),
    bin('local.bin'),
    bin('polar.bin'),
    bin('trees_local.bin'),
    bin('trees_far.bin'),
  ])
  data = {
    meta: metaRes,
    local: new Float32Array(local),
    polar: new Uint16Array(polar),
    treesLocal: new Float32Array(treesLocal),
    treesFar: new Float32Array(treesFar),
  }
  return data
}

export function world(): WorldData {
  if (!data) throw new Error('world data not loaded yet')
  return data
}
