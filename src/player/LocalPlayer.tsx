import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'
import { PLAYER, SITTING } from '../config'
import { RADIO, SEATS, type Seat } from '../lib/camp'
import { damp, lerpAngle } from '../lib/math'
import { heightAt } from '../lib/terrain'
import { myId } from '../net/useMultiplayer'
import { remotes } from '../net/remotes'
import { localRuntime, useGameStore } from '../store/gameStore'
import { useRadioStore } from '../store/radioStore'
import { Character } from './Character'
import { resolveCollisions } from './collision'
import { createMotionState } from './motion'
import { spawnLocalPlayer } from './spawn'
import { isSprintHeld, readMoveInput } from './useControls'

const input = { x: 0, y: 0 }
const SEAT_REACH = 1.7 // stop within this distance of a free seat to sit on it

/** Nearest seat on a log that nobody else is sitting on. */
function freeSeatNear(x: number, z: number): Seat | null {
  let best: Seat | null = null
  let bestD = SEAT_REACH
  for (const seat of SEATS) {
    const d = Math.hypot(seat.x - x, seat.z - z)
    if (d >= bestD) continue
    let taken = false
    for (const r of remotes.values()) {
      const p = r.buffer.latest
      if (r.sitting && p && Math.hypot(p.x - seat.x, p.z - seat.z) < 0.45) taken = true
    }
    if (!taken) {
      best = seat
      bestD = d
    }
  }
  return best
}

export function LocalPlayer() {
  const group = useRef<Group>(null!)
  const motion = useRef(createMotionState())
  const stillTime = useRef(0)
  const seat = useRef<Seat | null>(null)
  const name = useGameStore((s) => s.name)
  const colors = useGameStore((s) => s.colors)
  const look = useGameStore((s) => s.look)

  if (!localRuntime.spawned) spawnLocalPlayer()

  useFrame((_, rawDt) => {
    // Generous clamp: slow machines still walk at real speed, tab switches don't teleport.
    const dt = Math.min(rawDt, 0.1)
    const rt = localRuntime
    const pos = rt.position
    const vel = rt.velocity

    readMoveInput(input)
    const hasInput = input.x !== 0 || input.y !== 0
    // Shift + W: sprint (forward only, like most games)
    const sprinting = isSprintHeld() && input.y > 0.3
    const maxSpeed = sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed

    // Movement relative to the camera's heading.
    const yaw = rt.cameraYaw
    const fx = Math.sin(yaw)
    const fz = Math.cos(yaw)
    const targetX = (fx * input.y - fz * input.x) * maxSpeed
    const targetZ = (fz * input.y + fx * input.x) * maxSpeed
    const k = damp(hasInput ? (sprinting ? PLAYER.acceleration * 0.7 : PLAYER.acceleration) : PLAYER.deceleration, dt)
    vel.x += (targetX - vel.x) * k
    vel.z += (targetZ - vel.z) * k

    if (hasInput && rt.sitting) {
      // stand up from the log, stepping toward the fire
      rt.sitting = false
      seat.current = null
    }

    if (rt.sitting && seat.current) {
      // glide onto the seat and face the fire
      const s = seat.current
      const g = damp(6, dt)
      pos.x += (s.x - pos.x) * g
      pos.z += (s.z - pos.z) * g
      vel.set(0, 0, 0)
    } else {
      pos.x += vel.x * dt
      pos.z += vel.z * dt
      resolveCollisions(pos, PLAYER.radius, dt)
    }
    pos.y = heightAt(pos.x, pos.z)

    rt.speed = Math.hypot(vel.x, vel.z)
    rt.moving = rt.speed > 0.15

    // Stop by a free seat on a log for a moment and you sit down on it.
    const distToFire = Math.hypot(pos.x, pos.z)
    if (hasInput || rt.speed > 0.1) {
      stillTime.current = 0
    } else if (!rt.sitting) {
      stillTime.current += dt
      if (stillTime.current >= SITTING.delay) {
        const s = freeSeatNear(pos.x, pos.z)
        if (s) {
          seat.current = s
          rt.sitting = true
        }
      }
    }
    const warm = rt.sitting || (distToFire < SITTING.distance && stillTime.current > SITTING.delay)

    let targetRot = rt.rotY
    if (rt.sitting && seat.current) targetRot = seat.current.rotY
    else if (warm) targetRot = Math.atan2(-pos.x, -pos.z)
    else if (hasInput && rt.speed > 0.05) targetRot = Math.atan2(vel.x, vel.z)
    rt.rotY = lerpAngle(rt.rotY, targetRot, damp(PLAYER.turnSpeed, dt))

    group.current.position.copy(pos)
    group.current.rotation.y = rt.rotY

    motion.current.speed = rt.speed
    motion.current.sitting = rt.sitting

    const store = useGameStore.getState()
    if (store.sitting !== warm) store.setSitting(warm)
    // Anyone sitting on a log can reach the radio; otherwise walk up to it.
    const near = rt.sitting || Math.hypot(pos.x - RADIO.x, pos.z - RADIO.z) < RADIO.reach
    if (useRadioStore.getState().near !== near) useRadioStore.setState({ near })
  }, -2)

  return (
    <group ref={group}>
      <Character playerId={myId} name={name} look={look} colors={colors} motion={motion} />
    </group>
  )
}
