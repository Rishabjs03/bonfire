import { TREES, WORLD } from '../config'
import { createRng } from './random'

export interface TreeInstance {
  x: number
  z: number
  scale: number
  heightScale: number
  rotation: number
  shade: number
}

function generateForest(): TreeInstance[] {
  const rand = createRng(WORLD.seed)
  const trees: TreeInstance[] = []
  const minR = TREES.clearingRadius + 0.5
  let attempts = 0
  while (trees.length < TREES.count && attempts < TREES.count * 60) {
    attempts++
    const angle = rand() * Math.PI * 2
    // bias toward the clearing so the forest feels dense around the fire
    const r = minR + (TREES.spawnRadius - minR) * Math.pow(rand(), 0.8)
    const x = Math.sin(angle) * r
    const z = Math.cos(angle) * r
    const scale = TREES.minScale + rand() * (TREES.maxScale - TREES.minScale)
    const spacing = TREES.minSpacing * scale
    if (trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < spacing * spacing)) continue
    trees.push({
      x,
      z,
      scale,
      heightScale: 0.85 + rand() * 0.35,
      rotation: rand() * Math.PI * 2,
      shade: 0.75 + rand() * 0.35,
    })
  }
  return trees
}

export const FOREST: TreeInstance[] = generateForest()
