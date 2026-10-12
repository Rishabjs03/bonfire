import { TREES } from '../config'
import { VIEW_DIR } from '../world/directions'
import { world } from '../world/worldData'
import { createRng } from './random'

export type Species = 'larch' | 'pine'

export interface TreeInstance {
  x: number
  z: number
  /** Height in metres. */
  height: number
  rotation: number
  /** Brightness variation. */
  shade: number
  species: Species
}

const viewAngle = Math.atan2(VIEW_DIR.x, VIEW_DIR.z)
const SIGHTLINES = [
  { angle: viewAngle, halfWidth: TREES.viewCorridor, reach: 400 }, // the Matterhorn
  { angle: viewAngle + Math.PI / 2, halfWidth: TREES.sideCorridor, reach: 75 },
  { angle: viewAngle - Math.PI / 2, halfWidth: TREES.sideCorridor, reach: 75 },
]

function inSightline(x: number, z: number, r: number) {
  const a = Math.atan2(x, z)
  return SIGHTLINES.some((s) => {
    let d = Math.abs(a - s.angle) % (Math.PI * 2)
    if (d > Math.PI) d = Math.PI * 2 - d
    return r < s.reach && d < (s.halfWidth * Math.PI) / 180
  })
}

/** Local trees where the real forest is, from the SWISSIMAGE orthophoto (see build-terrain.mjs). */
function generateForest(): TreeInstance[] {
  const rand = createRng(4242)
  const src = world().treesLocal
  const trees: TreeInstance[] = []
  for (let i = 0; i < src.length; i += 4) {
    const x = src[i]
    const z = src[i + 2]
    const r = Math.hypot(x, z)
    if (r < TREES.clearingRadius) continue
    // Keep a clear sightline across the fire from every bench: toward the Matterhorn from
    // the back bench, and straight across from each side bench. Otherwise a tree lines up
    // behind the flames and looks like it's growing out of the fire.
    if (inSightline(x, z, r)) continue
    const species: Species = rand() < TREES.larchShare ? 'larch' : 'pine'
    // forest-edge trees are younger
    const edge = Math.min(1, (r - TREES.clearingRadius) / 25)
    const base = species === 'larch' ? 11 + rand() * 11 : 7 + rand() * 8
    trees.push({
      x,
      z,
      height: base * (0.65 + 0.35 * edge) * src[i + 3],
      rotation: rand() * Math.PI * 2,
      shade: 0.85 + rand() * 0.3,
      species,
    })
  }
  return trees
}

export const FOREST: TreeInstance[] = generateForest()

/** Trunk radius at the base for a tree of the given height. */
export const trunkRadius = (height: number) => 0.06 + height * 0.015
