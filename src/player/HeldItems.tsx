import { useMemo, useRef } from 'react'
import { createPortal, useFrame } from '@react-three/fiber'
import { Color, ConeGeometry, CylinderGeometry, Group, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, type Bone } from 'three'
import { ACTIVITY } from '../config'
import { fireState } from '../scene/fireState'
import { useSocialStore } from '../store/socialStore'
import { doneness } from './activity'

// ------------------------------------------------------------------ marshmallow on a stick

const UP = new Vector3(0, 1, 0)
const handWorld = new Vector3()
const parentQuat = new Quaternion()
const aim = new Quaternion()
const dir = new Vector3()
const parentScale = new Vector3()

const STAGE_COLORS = [new Color('#f6efe2'), new Color('#e6b45a'), new Color('#7a4418'), new Color('#1a1210')]
const tmpColor = new Color()

let stickParts: { stick: CylinderGeometry; mallow: SphereGeometry; flame: ConeGeometry; wood: MeshStandardMaterial; flameMat: MeshStandardMaterial } | null = null
function sharedStick() {
  if (stickParts) return stickParts
  const stick = new CylinderGeometry(0.006, 0.011, 1, 7, 1)
  stick.translate(0, 0.5, 0) // from the hand (origin) along +y
  const mallow = new SphereGeometry(0.035, 14, 10)
  mallow.scale(1, 1.25, 1)
  const flame = new ConeGeometry(0.03, 0.11, 8, 1, true)
  flame.translate(0, 0.055, 0)
  stickParts = {
    stick,
    mallow,
    flame,
    wood: new MeshStandardMaterial({ color: '#8a6a44', roughness: 0.9 }),
    flameMat: new MeshStandardMaterial({ color: '#ff9a2a', emissive: '#ff6a00', emissiveIntensity: 6, transparent: true, opacity: 0.85, depthWrite: false }),
  }
  return stickParts
}

/**
 * A stick held in the hand, pointed at the fire, with a marshmallow on the end that browns
 * (then burns) by how long it has been out. Everyone computes doneness from the same start time.
 */
function RoastStick({ startedAt }: { startedAt: number }) {
  const parts = useMemo(() => sharedStick(), [])
  const mat = useMemo(() => new MeshStandardMaterial({ color: STAGE_COLORS[0], roughness: 0.6, emissive: '#000000' }), [])
  const group = useRef<Group>(null!)
  const mallow = useRef<Group>(null!)
  const flame = useRef<Group>(null!)
  const reach = useRef(0)

  useFrame((state, dt) => {
    const g = group.current
    const p = g.parent
    if (!p) return
    // Aim from the hand to the fire, expressed in the hand bone's space.
    p.getWorldPosition(handWorld)
    p.getWorldQuaternion(parentQuat)
    dir.copy(fireState.position).sub(handWorld)
    dir.y += 0.25 // hold the marshmallow over the flames, not into the embers
    dir.normalize()
    aim.setFromUnitVectors(UP, dir)
    g.quaternion.copy(parentQuat.invert()).multiply(aim)
    // extend out of the hand over ~0.4 s
    reach.current = Math.min(1, reach.current + dt * 2.5)
    const len = ACTIVITY.stickLength * (0.3 + 0.7 * reach.current)
    p.getWorldScale(parentScale) // bones may carry the rig's scale: keep the stick in metres
    g.scale.set(1 / parentScale.x, len / parentScale.y, 1 / parentScale.z)
    mallow.current.position.y = len
    mallow.current.scale.setScalar(1 / len) // undo the parent's stretch

    const d = doneness(startedAt)
    const stage = Math.min(2, Math.floor(d))
    tmpColor.copy(STAGE_COLORS[stage]).lerp(STAGE_COLORS[stage + 1], d - stage)
    mat.color.copy(tmpColor)
    const burning = d >= 3
    mat.emissive.set(burning ? '#2a0a00' : '#000000')
    // sagging as it softens, then a little flame
    const soft = Math.min(1, Math.max(0, d - 1.5) / 1.5)
    mallow.current.rotation.z = -soft * 0.35
    mallow.current.scale.multiplyScalar(1 - soft * 0.15)
    flame.current.visible = burning
    if (burning) {
      const t = state.clock.elapsedTime
      const s = 0.85 + Math.sin(t * 19) * 0.15 + Math.sin(t * 31 + 1) * 0.1
      flame.current.scale.set(s, 0.9 + Math.sin(t * 23) * 0.25, s)
      flame.current.rotation.z = Math.sin(t * 7) * 0.2
    }
  })

  return (
    <group ref={group}>
      <mesh geometry={parts.stick} material={parts.wood} castShadow />
      <group ref={mallow}>
        <mesh geometry={parts.mallow} material={mat} castShadow />
        <group ref={flame} visible={false}>
          <mesh geometry={parts.flame} material={parts.flameMat} />
        </group>
      </group>
    </group>
  )
}

interface HeldItemsProps {
  playerId: string
  handR: Bone | undefined
}

/** Whatever this player is holding: a marshmallow stick in the right hand. */
export function HeldItems({ playerId, handR }: HeldItemsProps) {
  const act = useSocialStore((s) => s.acts[playerId])
  if (!act || !handR) return null
  if (act.value === 'roast') return createPortal(<RoastStick key={act.nonce} startedAt={act.at} />, handR)
  return null
}
