import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { PLAYER } from '../config'
import { fireState } from '../scene/fireState'
import { localRuntime, useGameStore } from '../store/gameStore'
import { audioEngine } from './audioEngine'

const STEP_LENGTH = 0.72 // metres per footstep
const right = new Vector3()

/** Feeds the listener's position, the fire and footsteps into the audio engine each frame. */
export function AudioDriver() {
  const last = useRef(new Vector3())
  const walked = useRef(0)

  useFrame(({ camera }) => {
    const joined = useGameStore.getState().phase === 'joined'
    const listener = joined ? localRuntime.position : camera.position
    const dx = fireState.position.x - listener.x
    const dz = fireState.position.z - listener.z
    const dist = Math.hypot(dx, dz)
    right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    const pan = dist > 0.01 ? (dx * right.x + dz * right.z) / dist : 0
    audioEngine.update({ fireDistance: dist, firePan: pan, flicker: fireState.flicker })

    if (joined) {
      const p = localRuntime.position
      const step = Math.hypot(p.x - last.current.x, p.z - last.current.z)
      if (step < 1 && localRuntime.moving && !localRuntime.sitting) {
        walked.current += step
        if (walked.current > STEP_LENGTH) {
          walked.current = 0
          audioEngine.footstep(0.55 + (localRuntime.speed / PLAYER.walkSpeed) * 0.5)
        }
      }
      last.current.copy(p)
    }
  })
  return null
}
