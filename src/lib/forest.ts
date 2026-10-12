import { TREES } from '../config'
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
