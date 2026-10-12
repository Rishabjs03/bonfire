import { useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import {
  CapsuleGeometry,
  Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import { FIRE, SITTING } from '../config'
import { damp } from '../lib/math'
import { FACE_COLOR, type CharacterColors } from '../lib/palette'
import { labelLayerRef } from '../ui/labelLayer'
import type { MotionState } from './motion'

// Shared geometry for every character.
const HEAD_Y = 0.98
const bodyGeo = new CapsuleGeometry(0.26, 0.32, 4, 12).translate(0, 0.42, 0)
const headGeo = new SphereGeometry(0.24, 16, 12)
const hatGeo = new SphereGeometry(0.255, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)
const cuffGeo = new TorusGeometry(0.245, 0.05, 6, 18).rotateX(Math.PI / 2)
const pomGeo = new SphereGeometry(0.075, 8, 6)
const scarfGeo = new TorusGeometry(0.2, 0.065, 6, 16).rotateX(Math.PI / 2)
const eyeGeo = new SphereGeometry(0.028, 6, 4)
const blushGeo = new SphereGeometry(0.035, 6, 4)

const eyeMat = new MeshBasicMaterial({ color: '#1a1414' })
const blushMat = new MeshBasicMaterial({ color: '#ff9a8a', transparent: true, opacity: 0.55 })

const knit = (color: string) =>
  new MeshStandardMaterial({ color, roughness: 0.9, emissive: FIRE.lightColor, emissiveIntensity: 0 })

interface CharacterProps {
  name: string
  colors: CharacterColors
  motion: RefObject<MotionState>
  /** Extra overlays above the head (chat bubbles, emotes). */
  children?: ReactNode
}

export function Character({ name, colors, motion, children }: CharacterProps) {
  const rig = useRef<Group>(null!)
  const head = useRef<Group>(null!)
  const anim = useRef({ walkPhase: 0, sit: 0, warmth: 0, speed: 0 })

  const mats = useMemo(
    () => ({ body: knit(colors.body), hat: knit(colors.hat), face: knit(FACE_COLOR) }),
    [colors.body, colors.hat],
  )

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const m = motion.current
    const a = anim.current
    a.speed += (m.speed - a.speed) * damp(10, dt)
    a.sit += ((m.sitting ? 1 : 0) - a.sit) * damp(5, dt)
    a.warmth += (m.warmth - a.warmth) * damp(2, dt)
    a.walkPhase += dt * (4 + a.speed * 7)

    const t = clock.elapsedTime
    const walk = a.speed
    const bob = Math.abs(Math.sin(a.walkPhase)) * 0.09 * walk
    const breathe = Math.sin(t * 2.2 + a.walkPhase * 0.1) * 0.018 * (1 - walk)
    const squash = 1 + Math.sin(a.walkPhase * 2) * 0.07 * walk + breathe - 0.14 * a.sit
    const stretch = 1 / Math.sqrt(squash)

    rig.current.position.y = bob - SITTING.lowerBy * a.sit
    rig.current.scale.set(stretch, squash, stretch)
    rig.current.rotation.x = 0.12 * walk + 0.08 * a.sit
    rig.current.rotation.z = Math.sin(a.walkPhase) * 0.06 * walk
    head.current.rotation.z = Math.sin(t * 0.7 + a.walkPhase * 0.05) * 0.05 * (1 - walk)

    const glow = a.warmth * 0.15
    mats.body.emissiveIntensity = glow
    mats.hat.emissiveIntensity = glow
    mats.face.emissiveIntensity = glow * 0.8
  })

  return (
    <group>
      <group ref={rig}>
        <mesh geometry={bodyGeo} material={mats.body} />
        <mesh geometry={scarfGeo} material={mats.hat} position={[0, 0.78, 0]} />
        <group ref={head} position={[0, HEAD_Y, 0]}>
          <mesh geometry={headGeo} material={mats.face} />
          <mesh geometry={hatGeo} material={mats.hat} position={[0, 0.02, 0]} scale={[1, 1.15, 1]} />
          <mesh geometry={cuffGeo} material={mats.hat} position={[0, 0.04, 0]} />
          <mesh geometry={pomGeo} material={mats.hat} position={[0, 0.34, 0]} />
          <mesh geometry={eyeGeo} material={eyeMat} position={[0.085, -0.02, 0.215]} />
          <mesh geometry={eyeGeo} material={eyeMat} position={[-0.085, -0.02, 0.215]} />
          <mesh geometry={blushGeo} material={blushMat} position={[0.14, -0.08, 0.18]} scale={[1, 0.6, 0.5]} />
          <mesh geometry={blushGeo} material={blushMat} position={[-0.14, -0.08, 0.18]} scale={[1, 0.6, 0.5]} />
        </group>
      </group>

      <Html position={[0, 1.65, 0]} center distanceFactor={9} zIndexRange={[5, 0]} portal={labelLayerRef as RefObject<HTMLElement>}>
        <div className="flex flex-col items-center gap-1 select-none">
          {children}
          <span className="whitespace-nowrap font-serif text-[13px] tracking-wide text-amber-50/70 [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]">
            {name}
          </span>
        </div>
      </Html>
    </group>
  )
}
