import { useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useTexture } from '@react-three/drei'
import {
  CapsuleGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  MeshStandardMaterial,
  RepeatWrapping,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  type Texture,
} from 'three'
import { damp } from '../lib/math'
import type { CharacterColors } from '../lib/palette'
import { ASSETS } from '../scene/assets'
import { labelLayerRef } from '../ui/labelLayer'
import { useSocialStore } from '../store/socialStore'
import type { MotionState } from './motion'
import { PlayerOverlays } from './Overlays'

// --- Shared geometry (metres, origin at the feet, facing +z) -------------------------

/** Quilted puffer-jacket body: a lathe profile with baffles every ~11 cm. */
function createParkaGeometry() {
  const pts: Vector2[] = []
  const profile: [number, number][] = [
    [0.0, 0.6],
    [0.215, 0.6],
    [0.235, 0.64],
    [0.232, 0.8],
    [0.225, 0.9],
    [0.236, 1.08],
    [0.242, 1.24],
    [0.225, 1.34],
    [0.18, 1.41],
    [0.125, 1.46],
    [0.115, 1.5],
    [0.0, 1.5],
  ]
  // Resample densely and add baffle bulges between y = 0.64 and 1.34.
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, y0] = profile[i]
    const [r1, y1] = profile[i + 1]
    const steps = Math.max(1, Math.round(Math.abs(y1 - y0) / 0.012))
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      const y = y0 + (y1 - y0) * t
      let r = r0 + (r1 - r0) * t
      if (y > 0.64 && y < 1.34 && r > 0.1) r += 0.011 * Math.pow(Math.abs(Math.sin(((y - 0.64) / 0.115) * Math.PI)), 0.6)
      pts.push(new Vector2(r, y))
    }
  }
  pts.push(new Vector2(0, 1.5))
  const geo = new LatheGeometry(pts, 28)
  geo.scale(1, 1, 0.78) // bodies are wider than they are deep
  geo.computeVertexNormals()
  return geo
}

function createHoodGeometry() {
  const g = new SphereGeometry(0.165, 28, 20, Math.PI / 2 + 0.68, Math.PI * 2 - 1.36, 0.12, Math.PI - 0.42)
  // Stretch toward a soft peak at the back-top, like a real parka hood.
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const back = Math.max(0, -z) / 0.165
    const top = Math.max(0, y) / 0.165
    p.setXYZ(i, x * 1.02, y * 1.12 + back * top * 0.03, z * 1.18 - top * back * 0.03)
  }
  g.computeVertexNormals()
  return g
}

const GEO = {
  parka: createParkaGeometry(),
  // Hood shell with the front (+z) slice cut away for the face opening.
  // Hood shell with the front (+z) slice cut away for the face opening; elongated like a parka hood.
  hood: createHoodGeometry(),
  head: new SphereGeometry(0.118, 16, 12).scale(0.92, 1.08, 0.95),
  scarf: new TorusGeometry(0.115, 0.045, 8, 20).rotateX(Math.PI / 2),
  upperArm: new CapsuleGeometry(0.074, 0.24, 4, 12).translate(0, -0.14, 0),
  forearm: new CapsuleGeometry(0.066, 0.22, 4, 12).translate(0, -0.13, 0),
  mitten: new SphereGeometry(0.055, 10, 8).scale(0.85, 1.25, 0.75).translate(0, -0.28, 0.01),
  thigh: new CapsuleGeometry(0.098, 0.3, 4, 12).translate(0, -0.25, 0), // top cap stays inside the hip
  shin: new CapsuleGeometry(0.084, 0.3, 4, 12).translate(0, -0.18, 0),
  boot: new CapsuleGeometry(0.068, 0.16, 4, 10).rotateX(Math.PI / 2).scale(1.1, 0.95, 1).translate(0, -0.39, 0.05),
}

// Joint positions.
const HIP_Y = 0.86
const HIP_X = 0.098
const KNEE_Y = -0.42
const SHOULDER_Y = 1.34
const SHOULDER_X = 0.205
const ELBOW_Y = -0.3
const SIT_DROP = 0.62

interface Materials {
  parka: MeshStandardMaterial
  accent: MeshStandardMaterial
  pants: MeshStandardMaterial
  boots: MeshStandardMaterial
  face: MeshStandardMaterial
}

function useCharacterMaterials(colors: CharacterColors): Materials {
  const tex = useTexture({
    fleeceNor: ASSETS.fabric.fleeceNor,
    fleeceRough: ASSETS.fabric.fleeceRough,
    cabanNor: ASSETS.fabric.cabanNor,
  })
  return useMemo(() => {
    const tiled = (t: Texture, repeat: number) => {
      const c = t.clone()
      c.wrapS = c.wrapT = RepeatWrapping
      c.repeat.set(repeat, repeat)
      c.needsUpdate = true
      return c
    }
    const fabric = (color: string, nor: Texture, repeat: number, roughness: number, normalScale = 0.6) =>
      new MeshStandardMaterial({
        color,
        roughness,
        metalness: 0,
        normalMap: tiled(nor, repeat),
        normalScale: new Vector2(normalScale, normalScale),
      })
    return {
      parka: Object.assign(fabric(colors.body, tex.cabanNor, 6, 0.78, 0.35), {
        roughnessMap: tiled(tex.fleeceRough, 6),
        side: DoubleSide, // hood lining is visible through the face opening
      }),
      accent: fabric(colors.hat, tex.fleeceNor, 4, 0.95, 1),
      pants: fabric('#24262b', tex.cabanNor, 5, 0.9),
      boots: new MeshStandardMaterial({ color: '#2b1e16', roughness: 0.55, metalness: 0 }),
      face: new MeshStandardMaterial({ color: '#030202', roughness: 1, metalness: 0, envMapIntensity: 0 }),
    }
  }, [colors.body, colors.hat, tex])
}

interface CharacterProps {
  /** Player id, for speech bubbles and emotes. */
  playerId: string
  name: string
  colors: CharacterColors
  motion: RefObject<MotionState>
  /** Extra overlays above the head (chat bubbles, emotes). */
  children?: ReactNode
}

/** A person in a hooded winter parka. Procedurally animated walk, idle, and sitting by the fire. */
export function Character({ playerId, name, colors, motion, children }: CharacterProps) {
  const mats = useCharacterMaterials(colors)
  const body = useRef<Group>(null!)
  const torso = useRef<Group>(null!)
  const hood = useRef<Group>(null!)
  const hips = useRef<(Group | null)[]>([])
  const knees = useRef<(Group | null)[]>([])
  const shoulders = useRef<(Group | null)[]>([])
  const elbows = useRef<(Group | null)[]>([])
  const sit = useRef(0)
  const anim = useRef({ phase: 0, speed: 0, wave: 0 })

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const m = motion.current
    const a = anim.current
    a.speed += (m.speed - a.speed) * damp(8, dt)
    sit.current += ((m.sitting ? 1 : 0) - sit.current) * damp(3.5, dt)
    // cadence: ~1 stride per 1.3 m at walking speed
    a.phase += dt * (1.2 + a.speed * 6.5)

    const w = a.speed * (1 - sit.current)
    const s = sit.current
    const t = clock.elapsedTime
    const ph = a.phase
    // Waving: right arm raised, hand swaying, for the length of the emote.
    const emote = useSocialStore.getState().emotes[playerId]
    const waving = emote?.value === 'wave' && Date.now() - emote.at < 2200 ? 1 : 0
    a.wave += (waving - a.wave) * damp(8, dt)
    const breathe = Math.sin(t * 1.7) * 0.008

    body.current.position.y = -SIT_DROP * s + (Math.abs(Math.cos(ph)) * 0.035 - 0.02) * w
    body.current.rotation.x = 0.06 * w
    torso.current.rotation.x = 0.16 * s + 0.04 * w
    torso.current.rotation.y = Math.sin(ph) * 0.07 * w
    torso.current.scale.set(1 + breathe, 1 + breathe * 0.5, 1 + breathe)
    hood.current.rotation.x = -0.1 * s + Math.sin(t * 0.4) * 0.03 * (1 - w)
    hood.current.rotation.y = Math.sin(t * 0.23) * 0.12 * (1 - w) * (1 - s)

    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? 1 : -1
      const swing = Math.sin(ph + side * Math.PI)
      const hip = hips.current[side]
      const knee = knees.current[side]
      const shoulder = shoulders.current[side]
      const elbow = elbows.current[side]
      if (!hip || !knee || !shoulder || !elbow) continue

      // legs: walk swing, or seated with knees drawn up
      hip.rotation.x = -swing * 0.42 * w + -1.95 * s
      hip.rotation.z = sign * 0.12 * s
      knee.rotation.x = (0.08 + 0.7 * Math.max(0, -Math.cos(ph + side * Math.PI))) * w + 2.25 * s

      // arms: counter-swing when walking; reaching to the fire, rubbing hands, when sitting
      const rub = Math.sin(t * 4.2 + side * Math.PI) * 0.07 * s
      shoulder.rotation.x = swing * 0.35 * w - 0.62 * s + rub
      shoulder.rotation.z = sign * (0.1 * (1 - s) + 0.04 * s)
      elbow.rotation.x = -0.25 * w - 1.25 * s - rub
      elbow.rotation.z = -sign * 0.55 * s
      if (side === 1 && a.wave > 0.01) {
        const v = a.wave
        shoulder.rotation.x = shoulder.rotation.x * (1 - v) - 0.35 * v
        shoulder.rotation.z = shoulder.rotation.z * (1 - v) - 2.5 * v
        elbow.rotation.x = elbow.rotation.x * (1 - v)
        elbow.rotation.z = elbow.rotation.z * (1 - v) + (-0.5 + Math.sin(t * 9) * 0.35) * v
      }
    }
  })

  const legs = [HIP_X, -HIP_X]
  const arms = [SHOULDER_X, -SHOULDER_X]

  return (
    <group>
      <group ref={body}>
        {/* legs */}
        {legs.map((x, i) => (
          <group
            key={`leg${i}`}
            position={[x, HIP_Y, 0]}
            ref={(g) => {
              hips.current[i] = g
            }}
          >
            <mesh geometry={GEO.thigh} material={mats.pants} castShadow />
            <group
              position={[0, KNEE_Y, 0]}
              ref={(g) => {
                knees.current[i] = g
              }}
            >
              <mesh geometry={GEO.shin} material={mats.pants} castShadow />
              <mesh geometry={GEO.boot} material={mats.boots} castShadow />
            </group>
          </group>
        ))}

        <group ref={torso}>
          <mesh geometry={GEO.parka} material={mats.parka} castShadow receiveShadow />
          <mesh geometry={GEO.scarf} material={mats.accent} position={[0, 1.45, 0.01]} castShadow />

          {/* arms */}
          {arms.map((x, i) => (
            <group
              key={`arm${i}`}
              position={[x, SHOULDER_Y, 0]}
              ref={(g) => {
                shoulders.current[i] = g
              }}
            >
              <mesh geometry={GEO.upperArm} material={mats.parka} castShadow />
              <group
                position={[0, ELBOW_Y, 0]}
                ref={(g) => {
                  elbows.current[i] = g
                }}
              >
                <mesh geometry={GEO.forearm} material={mats.parka} castShadow />
                <mesh geometry={GEO.mitten} material={mats.accent} castShadow />
              </group>
            </group>
          ))}

          {/* hood up against the evening breeze; the face lost in its shadow */}
          <group ref={hood} position={[0, 1.6, -0.025]}>
            <mesh geometry={GEO.hood} material={mats.parka} castShadow />
            <mesh geometry={GEO.head} material={mats.face} position={[0, -0.02, 0.0]} />
          </group>
        </group>
      </group>

      <Html position={[0, 2.05, 0]} center distanceFactor={7} zIndexRange={[5, 0]} portal={labelLayerRef as RefObject<HTMLElement>}>
        <div className="flex flex-col items-center gap-1 select-none">
          <PlayerOverlays id={playerId} />
          {children}
          <span className="whitespace-nowrap font-serif text-[12px] tracking-wide text-amber-50/60 [text-shadow:0_1px_6px_rgba(0,0,0,0.95)]">
            {name}
          </span>
        </div>
      </Html>
    </group>
  )
}
