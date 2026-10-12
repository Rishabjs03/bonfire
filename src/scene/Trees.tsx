import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { Color, InstancedMesh, MeshStandardMaterial, Object3D, RepeatWrapping, SRGBColorSpace, Vector3 } from 'three'
import { createTree, type TreeGeometry } from '../lib/firTree'
import { FOREST, type Species, type TreeInstance } from '../lib/forest'
import { heightAt } from '../lib/terrain'
import { localRuntime, useGameStore } from '../store/gameStore'
import { ASSETS } from './assets'
import { FAR_LAYER } from './layers'
import { useQuality } from '../store/quality'
import { LocalImpostors } from './Impostors'
import { createBarkMaterial, createFoliageMaterial, treeUniforms } from './treeMaterials'

/** Pre-built heights per species; each tree uses the nearest and scales to fit. */
const VARIANTS: Record<Species, number[]> = { larch: [6, 11, 16, 21], pine: [5, 8.5, 12] }
type Tier = 'near' | 'far'
const ORIGIN = new Vector3()

interface VariantProps {
  geometry: TreeGeometry
  variantHeight: number
  trees: TreeInstance[]
  foliage: MeshStandardMaterial
  bark: MeshStandardMaterial
  tier: Tier
}

function TreeVariant({ geometry, variantHeight, trees, foliage, bark, tier }: VariantProps) {
  const foliageRef = useRef<InstancedMesh>(null!)
  const barkRef = useRef<InstancedMesh>(null!)

  useLayoutEffect(() => {
    if (trees.length === 0) return
    const dummy = new Object3D()
    const tint = new Color()
    trees.forEach((t, i) => {
      const s = t.height / variantHeight
      const w = 0.9 + (t.shade - 0.85) * 0.5
      dummy.position.set(t.x, heightAt(t.x, t.z), t.z)
      dummy.rotation.set(0, t.rotation, 0)
      dummy.scale.set(s * w, s, s * w)
      dummy.updateMatrix()
      foliageRef.current.setMatrixAt(i, dummy.matrix)
      barkRef.current.setMatrixAt(i, dummy.matrix)
      foliageRef.current.setColorAt(i, tint.setScalar(t.shade))
    })
    for (const mesh of [foliageRef.current, barkRef.current]) {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
      if (tier === 'far') mesh.layers.set(FAR_LAYER)
    }
  }, [trees, variantHeight, tier])

  if (trees.length === 0) return null
  return (
    <>
      <instancedMesh ref={foliageRef} args={[geometry.foliage, foliage, trees.length]} castShadow receiveShadow />
      <instancedMesh ref={barkRef} args={[geometry.bark, bark, trees.length]} castShadow receiveShadow />
    </>
  )
}

/** The real Riffelalp forest around the clearing: European larch and Swiss stone pine. */
export function Trees() {
  const tex = useTexture({
    fir: ASSETS.fir.twigDiff,
    firAlpha: ASSETS.fir.twigAlpha,
    pine: ASSETS.pine.twigDiff,
    pineAlpha: ASSETS.pine.twigAlpha,
    bark: ASSETS.fir.barkDiff,
    barkNor: ASSETS.fir.barkNor,
  })

  const mats = useMemo(() => {
    tex.fir.colorSpace = SRGBColorSpace
    tex.pine.colorSpace = SRGBColorSpace
    tex.bark.colorSpace = SRGBColorSpace
    for (const t of [tex.bark, tex.barkNor]) t.wrapS = t.wrapT = RepeatWrapping
    for (const t of Object.values(tex)) t.anisotropy = 8
    return {
      larch: { foliage: createFoliageMaterial(tex.fir, tex.firAlpha), bark: createBarkMaterial(tex.bark, tex.barkNor, '#a07d68') },
      pine: { foliage: createFoliageMaterial(tex.pine, tex.pineAlpha), bark: createBarkMaterial(tex.bark, tex.barkNor, '#8b8682') },
    }
  }, [tex])

  const near = useQuality((q) => q.settings.treesNear)
  const mid = useQuality((q) => q.settings.treesMid)

  const variants = useMemo(() => {
    const out: { species: Species; height: number; geometry: { near: TreeGeometry; far: TreeGeometry } }[] = []
    for (const species of ['larch', 'pine'] as const) {
      VARIANTS[species].forEach((h, i) => {
        const seed = (species === 'larch' ? 9001 : 7001) + i * 31
        out.push({ species, height: h, geometry: { near: createTree(species, h, seed), far: createTree(species, h, seed, true) } })
      })
    }
    return out
  }, [])

  // Full detail near the fire, light detail further out, impostor cards beyond:
  // dense forest edges are mostly overdraw, which cards make cheap.
  const { groups, impostors } = useMemo(() => {
    const groups = variants.map((v) => ({ ...v, trees: { near: [] as TreeInstance[], far: [] as TreeInstance[] } }))
    const impostors: TreeInstance[] = []
    for (const t of FOREST) {
      const r = Math.hypot(t.x, t.z)
      if (r >= mid) {
        impostors.push(t)
        continue
      }
      const candidates = groups.filter((g) => g.species === t.species)
      let best = candidates[0]
      for (const c of candidates) if (Math.abs(c.height - t.height) < Math.abs(best.height - t.height)) best = c
      best.trees[r < near ? 'near' : 'far'].push(t)
    }
    return { groups, impostors }
  }, [variants, near, mid])

  useFrame(({ camera, clock }) => {
    treeUniforms.uTime.value = clock.elapsedTime
    const p = useGameStore.getState().phase === 'joined' ? localRuntime.position : ORIGIN
    treeUniforms.uPlayerView.value.set(p.x, p.y + 1.0, p.z).applyMatrix4(camera.matrixWorldInverse)
  })

  return (
    <group>
      {groups.map((g, i) =>
        (['near', 'far'] as const).map((tier) => (
          <TreeVariant
            key={`${i}-${tier}-${near}-${mid}`}
            geometry={g.geometry[tier]}
            variantHeight={g.height}
            trees={g.trees[tier]}
            foliage={mats[g.species].foliage}
            bark={mats[g.species].bark}
            tier={tier}
          />
        )),
      )}
      <LocalImpostors trees={impostors} />
    </group>
  )
}
