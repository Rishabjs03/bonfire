import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import {
  CanvasTexture,
  CylinderGeometry,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { BENCHES, RADIO, WOODPILE } from '../lib/camp'
import { createRng } from '../lib/random'
import { heightAt } from '../lib/terrain'
import { useRadioStore } from '../store/radioStore'
import { ASSETS } from './assets'

/** Cross-section of a sawn log: heartwood, growth rings, sapwood and a ring of bark. */
function ringsTexture() {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const rand = createRng(808)
  const g = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2)
  g.addColorStop(0, '#a77a4c')
  g.addColorStop(0.75, '#c99a68')
  g.addColorStop(0.9, '#b58658')
  g.addColorStop(0.94, '#4a3424')
  g.addColorStop(1, '#2c1f16')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  for (let r = 6; r < size * 0.45; r += 3 + rand() * 4) {
    ctx.strokeStyle = `rgba(90, 58, 32, ${0.15 + rand() * 0.25})`
    ctx.lineWidth = 0.6 + rand() * 1.4
    ctx.beginPath()
    ctx.ellipse(size / 2 + (rand() - 0.5) * 3, size / 2 + (rand() - 0.5) * 3, r, r * (0.94 + rand() * 0.06), rand() * 3, 0, Math.PI * 2)
    ctx.stroke()
  }
  // a couple of drying cracks
  ctx.strokeStyle = 'rgba(40, 26, 16, 0.55)'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 3; i++) {
    const a = rand() * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(size / 2 + Math.cos(a) * 20, size / 2 + Math.sin(a) * 20)
    ctx.lineTo(size / 2 + Math.cos(a) * 110, size / 2 + Math.sin(a) * 110)
    ctx.stroke()
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

function useWoodMaterials() {
  const tex = useTexture({ bark: ASSETS.fir.logDiff, nor: ASSETS.fir.logNor })
  return useMemo(() => {
    tex.bark.colorSpace = SRGBColorSpace
    for (const t of [tex.bark, tex.nor]) {
      t.wrapS = t.wrapT = RepeatWrapping
      t.repeat.set(2, 1.5)
    }
    const rings = ringsTexture()
    const bark = new MeshStandardMaterial({ map: tex.bark, normalMap: tex.nor, roughness: 0.95, color: '#c8b8a8' })
    const ends = new MeshStandardMaterial({ map: rings, roughness: 0.85 })
    return [bark, ends, ends]
  }, [tex])
}

/** Big halved-trunk benches to sit on around the fire. */
function Benches({ wood }: { wood: MeshStandardMaterial[] }) {
  return (
    <group>
      {BENCHES.map((b, i) => {
        const geo = new CylinderGeometry(b.radius, b.radius * 1.06, b.length, 18, 1)
        geo.rotateZ(Math.PI / 2)
        const y = heightAt(b.x, b.z) + b.radius - 0.03
        return (
          <mesh
            key={i}
            geometry={geo}
            material={wood}
            position={[b.x, y, b.z]}
            rotation={[0.04 * (i - 1), Math.atan2(-b.tz, b.tx), 0]}
            castShadow
            receiveShadow
          />
        )
      })}
    </group>
  )
}

/** A cord of split firewood between two posts, ends facing out. */
function Woodpile({ wood }: { wood: MeshStandardMaterial[] }) {
  const mesh = useMemo(() => {
    const rand = createRng(77)
    const geo = new CylinderGeometry(0.085, 0.085, 0.48, 7, 1)
    geo.rotateX(Math.PI / 2) // log axis along the pile's depth
    const layers = 8
    const perRow = 11
    const im = new InstancedMesh(geo, wood, layers * perRow)
    const m = new Matrix4()
    const q = new Quaternion()
    const e = new Euler()
    const p = new Vector3()
    const s = new Vector3()
    let i = 0
    for (let layer = 0; layer < layers; layer++)
      for (let k = 0; k < perRow; k++) {
        const x = -0.85 + k * 0.165 + (layer % 2) * 0.08 + (rand() - 0.5) * 0.02
        p.set(x, 0.085 + layer * 0.15, (rand() - 0.5) * 0.08)
        e.set((rand() - 0.5) * 0.08, (rand() - 0.5) * 0.1, (rand() - 0.5) * 0.3)
        q.setFromEuler(e)
        const r = 0.8 + rand() * 0.45
        s.set(r, 0.9 + rand() * 0.25, r)
        m.compose(p, q, s)
        im.setMatrixAt(i++, m)
      }
    im.castShadow = true
    im.receiveShadow = true
    return im
  }, [wood])
  const y = heightAt(WOODPILE.x, WOODPILE.z)
  return (
    <group position={[WOODPILE.x, y, WOODPILE.z]} rotation={[0, WOODPILE.rotY, 0]}>
      <primitive object={mesh} />
      {[-1.0, 1.0].map((x) => (
        <mesh key={x} position={[x, 0.65, 0]} castShadow material={wood[0]}>
          <cylinderGeometry args={[0.05, 0.06, 1.3, 7]} />
        </mesh>
      ))}
    </group>
  )
}

/** A battered old portable radio on a stump: it glows when *you* are playing music. */
function RadioSet({ wood }: { wood: MeshStandardMaterial[] }) {
  const playing = useRadioStore((s) => s.playing)
  const mats = useMemo(
    () => ({
      body: new MeshStandardMaterial({ color: '#6b4a2f', roughness: 0.55 }),
      grille: new MeshStandardMaterial({ color: '#2a2622', roughness: 0.9 }),
      chrome: new MeshStandardMaterial({ color: '#c9c3b8', roughness: 0.25, metalness: 0.9 }),
      dial: new MeshStandardMaterial({ color: '#d8c9a0', roughness: 0.4, emissive: '#ffb45a', emissiveIntensity: 0 }),
    }),
    [],
  )
  useFrame(({ clock }) => {
    const target = playing ? 1.4 + Math.sin(clock.elapsedTime * 2.1) * 0.08 : 0
    mats.dial.emissiveIntensity += (target - mats.dial.emissiveIntensity) * 0.1
  })
  const y = heightAt(RADIO.x, RADIO.z)
  return (
    <group position={[RADIO.x, y, RADIO.z]} rotation={[0, RADIO.rotY, 0]}>
      <mesh material={wood} position={[0, 0.27, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.34, 0.54, 18]} />
      </mesh>
      <group position={[0, 0.54, 0]} rotation={[0, 0.25, 0]} scale={1.35}>
        <mesh material={mats.body} position={[0, 0.12, 0]} castShadow>
          <boxGeometry args={[0.36, 0.22, 0.13]} />
        </mesh>
        <mesh material={mats.grille} position={[-0.07, 0.12, 0.066]}>
          <circleGeometry args={[0.07, 24]} />
        </mesh>
        {[0.025, 0.045, 0.065].map((r) => (
          <mesh key={r} material={mats.chrome} position={[-0.07, 0.12, 0.067]}>
            <ringGeometry args={[r - 0.002, r, 24]} />
          </mesh>
        ))}
        <mesh material={mats.dial} position={[0.1, 0.15, 0.066]}>
          <planeGeometry args={[0.12, 0.05]} />
        </mesh>
        {[0.06, 0.13].map((x) => (
          <mesh key={x} material={mats.chrome} position={[x, 0.07, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 0.02, 12]} />
          </mesh>
        ))}
        <mesh material={mats.chrome} position={[0, 0.27, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.07, 0.008, 6, 16, Math.PI]} />
        </mesh>
        <mesh material={mats.chrome} position={[0.15, 0.42, -0.03]} rotation={[0, 0, -0.35]}>
          <cylinderGeometry args={[0.003, 0.004, 0.4, 5]} />
        </mesh>
      </group>
    </group>
  )
}

/** The camp around the fire: benches, firewood and the radio. */
export function Camp() {
  const wood = useWoodMaterials()
  return (
    <group>
      <Benches wood={wood} />
      <Woodpile wood={wood} />
      <RadioSet wood={wood} />
    </group>
  )
}
