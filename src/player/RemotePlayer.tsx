import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'
import { PLAYER } from '../config'
import { SEATS } from '../lib/camp'
import { damp, lerpAngle } from '../lib/math'
import { heightAt } from '../lib/terrain'
import { remotes } from '../net/remotes'
import { useGameStore, type RemotePlayerInfo } from '../store/gameStore'
import { Character } from './Character'
import { createMotionState } from './motion'

function RemotePlayer({ id, name, colors, look }: RemotePlayerInfo) {
  const group = useRef<Group>(null!)
  const motion = useRef(createMotionState())
  const pose = useRef({ x: 0, z: 0, rotY: 0 })
  const shown = useRef({ x: 0, z: 0, rotY: 0, speed: 0, init: false })

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const r = remotes.get(id)
    if (!r || !r.buffer.sample(performance.now(), pose.current)) return
    const s = shown.current
    const p = pose.current
    const seated = r.sitting && !r.moving
    if (seated) {
      // Anyone sitting is on a seat: snap to the nearest one, however far off the reported
      // position is, so a stale or coarse update can never leave them hovering beside the log.
      let best = SEATS[0]
      let bestD = Infinity
      for (const seat of SEATS) {
        const d = Math.hypot(seat.x - p.x, seat.z - p.z)
        if (d < bestD) {
          best = seat
          bestD = d
        }
      }
      p.x = best.x
      p.z = best.z
      p.rotY = best.rotY
    }
    if (!s.init) {
      Object.assign(s, p, { init: true })
    }
    const dx = p.x - s.x
    const dz = p.z - s.z
    s.x = p.x
    s.z = p.z
    const speed = dt > 0 ? Math.hypot(dx, dz) / dt : 0
    s.speed += (speed - s.speed) * damp(6, dt)
    s.rotY = lerpAngle(s.rotY, p.rotY, damp(PLAYER.turnSpeed, dt))

    group.current.position.set(s.x, heightAt(s.x, s.z), s.z)
    group.current.rotation.y = s.rotY
    motion.current.speed = s.speed
    motion.current.sitting = seated
  })

  return (
    <group ref={group}>
      <Character playerId={id} name={name} look={look} colors={colors} motion={motion} />
    </group>
  )
}

export function RemotePlayers() {
  const players = useGameStore((s) => s.players)
  return (
    <>
      {Object.values(players).map((p) => (
        <RemotePlayer key={p.id} {...p} />
      ))}
    </>
  )
}
