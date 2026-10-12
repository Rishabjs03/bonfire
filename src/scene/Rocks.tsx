import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, Mesh, type Object3D } from 'three'
import { ROCKS } from '../lib/rocks'
import { heightAt } from '../lib/terrain'
import { ASSETS } from './assets'

function firstMesh(root: Object3D) {
  let mesh: Mesh | null = null
  root.traverse((o) => {
    if (!mesh && (o as Mesh).isMesh) mesh = o as Mesh
  })
  return mesh as unknown as Mesh
}

/** Photo-scanned boulders (Poly Haven, CC0), half-sunk into the meadow. */
export function Rocks() {
  const a = useGLTF(ASSETS.rocks[0])
  const b = useGLTF(ASSETS.rocks[1])
  const models = useMemo(
    () =>
      [a.scene, b.scene].map((s) => {
        const mesh = firstMesh(s)
        const box = new Box3().setFromObject(s)
        return { mesh, height: box.max.y - box.min.y, bottom: box.min.y }
      }),
    [a.scene, b.scene],
  )
  return (
    <group>
      {ROCKS.map((r, i) => {
        const m = models[r.model]
        const y = heightAt(r.x, r.z) - (m.bottom + m.height * 0.3) * r.scale
        return (
          <mesh
            key={i}
            geometry={m.mesh.geometry}
            material={m.mesh.material}
            position={[r.x, y, r.z]}
            rotation={[0, r.rotation, 0]}
            scale={r.scale}
            castShadow
            receiveShadow
          />
        )
      })}
    </group>
  )
}
