import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color, ConeGeometry, DodecahedronGeometry, Mesh, MeshBasicMaterial, PointLight } from 'three'
import { FIRE, WORLD } from '../config'
import { createRng } from '../lib/random'
import { Embers } from './Embers'

const LOG_COUNT = 5
const STONE_COUNT = 11

interface FlameSpec {
  x: number
  z: number
  radius: number
  height: number
  color: string
  phase: number
}

/** Outer orange to inner pale-yellow. Colors are pushed above 1 so bloom catches them. */
const FLAMES: FlameSpec[] = [
  { x: 0, z: 0, radius: 0.5, height: 1.5, color: '#ff5a14', phase: 0 },
  { x: 0.2, z: 0.12, radius: 0.32, height: 1.0, color: '#ff7a24', phase: 1.3 },
  { x: -0.2, z: 0.1, radius: 0.3, height: 1.1, color: '#ff7a24', phase: 2.7 },
  { x: 0.02, z: -0.2, radius: 0.3, height: 0.95, color: '#ff7a24', phase: 4.1 },
  { x: 0, z: 0, radius: 0.32, height: 1.05, color: '#ffb347', phase: 0.7 },
  { x: 0, z: 0, radius: 0.17, height: 0.65, color: '#fff0b0', phase: 3.3 },
]

const flameGeometry = new ConeGeometry(1, 1, 6, 1, true).translate(0, 0.5, 0)
const stoneGeometry = new DodecahedronGeometry(0.22, 0)

/** Cheap smooth 1D noise from layered sines with incommensurate frequencies. */
const flicker = (t: number) =>
  Math.sin(t * 8.3) * 0.45 + Math.sin(t * 13.7 + 1.3) * 0.3 + Math.sin(t * 23.1 + 0.7) * 0.15 + Math.sin(t * 3.1) * 0.1

function Flames() {
  const meshes = useRef<(Mesh | null)[]>([])
  const materials = useMemo(
    () =>
      FLAMES.map(
        (f) =>
          new MeshBasicMaterial({
            color: new Color(f.color).multiplyScalar(2.2),
            transparent: true,
            opacity: 0.75,
            blending: AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
            fog: false,
          }),
      ),
    [],
  )

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * FIRE.flickerSpeed
    FLAMES.forEach((f, i) => {
      const mesh = meshes.current[i]
      if (!mesh) return
      const n = flicker(t + f.phase)
      const sy = f.height * (1 + n * 0.18)
      const sxz = f.radius * (1 - n * 0.08)
      mesh.scale.set(sxz, sy, sxz)
      mesh.rotation.y = t * 0.6 + f.phase
      mesh.rotation.z = Math.sin(t * 2.1 + f.phase) * 0.06
      mesh.rotation.x = Math.cos(t * 1.7 + f.phase) * 0.06
    })
  })

  return (
    <group position={[0, 0.25, 0]}>
      {FLAMES.map((f, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m
          }}
          geometry={flameGeometry}
          material={materials[i]}
          position={[f.x, 0, f.z]}
        />
      ))}
    </group>
  )
}

function FireLight() {
  const light = useRef<PointLight>(null!)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * FIRE.flickerSpeed
    const n = flicker(t * 0.9) * 0.7 + Math.sin(t * 31.0) * 0.1 + (Math.random() - 0.5) * 0.2
    light.current.intensity = FIRE.lightIntensity * (1 + n * FIRE.flickerAmount)
    light.current.position.set(Math.sin(t * 3.1) * 0.08, FIRE.lightHeight + n * 0.08, Math.cos(t * 2.7) * 0.08)
  })
  return (
    <pointLight
      ref={light}
      color={FIRE.lightColor}
      intensity={FIRE.lightIntensity}
      distance={FIRE.lightDistance}
      decay={FIRE.lightDecay}
      position={[0, FIRE.lightHeight, 0]}
    />
  )
}

function Logs() {
  return (
    <group>
      {Array.from({ length: LOG_COUNT }, (_, i) => (
        <group key={i} rotation={[0, (i / LOG_COUNT) * Math.PI * 2 + 0.3, 0]}>
          <mesh position={[0, 0.42, 0.42]} rotation={[-0.62, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.12, 1.25, 6]} />
            <meshStandardMaterial color="#3a2618" emissive="#ff4a10" emissiveIntensity={0.25} roughness={1} flatShading />
          </mesh>
        </group>
      ))}
      {[0.4, -0.9].map((rot, i) => (
        <mesh key={`base-${i}`} position={[0, 0.1, 0]} rotation={[0, rot, Math.PI / 2]}>
          <cylinderGeometry args={[0.11, 0.11, 1.5, 6]} />
          <meshStandardMaterial color="#2e1d12" emissive="#ff3a08" emissiveIntensity={0.18} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  )
}

function Stones() {
  const stones = useMemo(() => {
    const rand = createRng(WORLD.seed + 7)
    return Array.from({ length: STONE_COUNT }, (_, i) => {
      const a = (i / STONE_COUNT) * Math.PI * 2 + rand() * 0.15
      const s = 0.8 + rand() * 0.6
      return {
        position: [Math.sin(a) * FIRE.stoneRingRadius, 0.08 * s, Math.cos(a) * FIRE.stoneRingRadius] as const,
        rotation: [rand() * 3, rand() * 3, rand() * 3] as const,
        scale: [s, s * 0.75, s] as const,
      }
    })
  }, [])

  return (
    <group>
      {stones.map((s, i) => (
        <mesh key={i} geometry={stoneGeometry} position={s.position} rotation={s.rotation} scale={s.scale}>
          <meshStandardMaterial color="#5a5f6a" roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  )
}

export function Bonfire() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[FIRE.stoneRingRadius + 0.1, 20]} />
        <meshStandardMaterial color="#1b1512" roughness={1} />
      </mesh>
      <Stones />
      <Logs />
      <Flames />
      <Embers />
      <FireLight />
    </group>
  )
}
