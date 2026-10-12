import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'
import { PLAYER, SITTING } from '../config'
import { clamp, damp, lerpAngle } from '../lib/math'
import { heightAt } from '../lib/terrain'
import { localRuntime, useGameStore } from '../store/gameStore'
import { Character } from './Character'
import { myId } from '../net/useMultiplayer'
import { createMotionState } from './motion'
import { spawnLocalPlayer } from './spawn'
import { resolveCollisions } from './collision'
import { isSlowHeld, readMoveInput } from './useControls'

const input = { x: 0, y: 0 }

export function LocalPlayer() {
  const group = useRef<Group>(null!)
  const motion = useRef(createMotionState())
  const stillTime = useRef(0)
  const name = useGameStore((s) => s.name)
  const colors = useGameStore((s) => s.colors)

  if (!localRuntime.spawned) spawnLocalPlayer()

  useFrame((_, rawDt) => {
    // Generous clamp: slow machines still walk at real speed, tab switches don't teleport.
    const dt = Math.min(rawDt, 0.1)
    const rt = localRuntime
    const pos = rt.position
    const vel = rt.velocity

    readMoveInput(input)
    const hasInput = input.x !== 0 || input.y !== 0
    const maxSpeed = isSlowHeld() ? PLAYER.slowSpeed : PLAYER.walkSpeed

    // Movement relative to the camera's heading.
    const yaw = rt.cameraYaw
    const fx = Math.sin(yaw)
    const fz = Math.cos(yaw)
    const targetX = (fx * input.y - fz * input.x) * maxSpeed
    const targetZ = (fz * input.y + fx * input.x) * maxSpeed
    const k = damp(hasInput ? PLAYER.acceleration : PLAYER.deceleration, dt)
    vel.x += (targetX - vel.x) * k
    vel.z += (targetZ - vel.z) * k

    pos.x += vel.x * dt
    pos.z += vel.z * dt
    resolveCollisions(pos, PLAYER.radius, dt)
    pos.y = heightAt(pos.x, pos.z)

    rt.speed = Math.hypot(vel.x, vel.z)
    rt.moving = rt.speed > 0.15

    // Sit down after standing still near the fire; any input stands back up.
    const distToFire = Math.hypot(pos.x, pos.z)
    if (hasInput) {
      stillTime.current = 0
      rt.sitting = false
    } else if (distToFire < SITTING.distance && rt.speed < 0.1) {
      stillTime.current += dt
      if (stillTime.current >= SITTING.delay) rt.sitting = true
    } else {
      stillTime.current = 0
    }

    let targetRot = rt.rotY
    if (rt.sitting) targetRot = Math.atan2(-pos.x, -pos.z)
    else if (hasInput && rt.speed > 0.05) targetRot = Math.atan2(vel.x, vel.z)
    rt.rotY = lerpAngle(rt.rotY, targetRot, damp(PLAYER.turnSpeed, dt))

    group.current.position.copy(pos)
    group.current.rotation.y = rt.rotY

    const m = motion.current
    m.speed = Math.min(1, rt.speed / PLAYER.walkSpeed)
    m.sitting = rt.sitting
    m.warmth = rt.sitting ? 1 : clamp((7 - distToFire) / 5, 0, 1) * 0.5

    if (useGameStore.getState().sitting !== rt.sitting) useGameStore.getState().setSitting(rt.sitting)
  }, -2)

  return (
    <group ref={group}>
      <Character playerId={myId} name={name} colors={colors} motion={motion} />
    </group>
  )
}
