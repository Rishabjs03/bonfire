import { TREES, VIEW_DIR, WORLD } from '../config'
import { createRng } from './random'

export interface TreeInstance {
  x: number
  z: number
  /** Target height in metres. */
  height: number
  rotation: number
  /** Brightness variation. */
  shade: number
}

function generateForest(): TreeInstance[] {
  const rand = createRng(WORLD.seed)
  const trees: TreeInstance[] = []
  const wedgeCos = Math.cos((TREES.viewWedge * Math.PI) / 180)
  let attempts = 0
  while (trees.length < TREES.count && attempts < TREES.count * 80) {
    attempts++
    const angle = rand() * Math.PI * 2
    const r = TREES.clearingRadius + (TREES.spawnRadius - TREES.clearingRadius) * Math.pow(rand(), 0.85)
    const x = Math.sin(angle) * r
    const z = Math.cos(angle) * r
    const facing = (x * VIEW_DIR.x + z * VIEW_DIR.z) / r

    // Keep the view toward the Matterhorn open: only a few young trees there.
    const inWedge = facing > wedgeCos
    if (inWedge && rand() > 0.12) continue

    // Like a real forest edge: young, shorter trees at the clearing, old giants deeper in.
    const edge = Math.min(1, (r - TREES.clearingRadius) / 22)
    let height = 4.5 + rand() * 6 + edge * 12
    if (rand() < 0.16 || inWedge) height = 2.2 + rand() * 4.5

    const spacing = TREES.minSpacing * Math.max(0.55, height / 16)
    if (trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < spacing * spacing)) continue
    trees.push({ x, z, height, rotation: rand() * Math.PI * 2, shade: 0.8 + rand() * 0.35 })
  }
  return trees
}

export const FOREST: TreeInstance[] = generateForest()

/** Trunk radius at the base for a tree of the given height. */
export const trunkRadius = (height: number) => 0.06 + height * 0.014
