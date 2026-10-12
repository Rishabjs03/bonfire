import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'
import { PLAYER } from '../config'
import { damp, lerpAngle } from '../lib/math'
import { heightAt } from '../lib/terrain'
import { remotes } from '../net/remotes'
import { useGameStore, type RemotePlayerInfo } from '../store/gameStore'
import { Character } from './Character'
import { createMotionState } from './motion'

function RemotePlayer({ id, name, colors }: RemotePlayerInfo) {
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
    motion.current.speed = Math.min(1, s.speed / PLAYER.walkSpeed)
    motion.current.sitting = r.sitting && s.speed < 0.2
  })

  return (
    <group ref={group}>
      <Character name={name} colors={colors} motion={motion} />
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
