import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { CAMERA } from '../config'
import { damp, smoothstep } from '../lib/math'
import { heightAt } from '../lib/terrain'
import { localRuntime } from '../store/gameStore'
import { readOrbitInput } from './useControls'

const DRAG_SENSITIVITY = 0.005
const ORBIT_SPEED = 1.8

/** Third-person follow camera. Drag (or Q/E) to orbit around the player. */
export function CameraRig() {
  const gl = useThree((s) => s.gl)
  const desired = useRef(new Vector3())
  const look = useRef(new Vector3())
  const initialized = useRef(false)

  useEffect(() => {
    const el = gl.domElement
    let dragging: number | null = null
    let lastX = 0
    const down = (e: PointerEvent) => {
      dragging = e.pointerId
      lastX = e.clientX
    }
    const move = (e: PointerEvent) => {
      if (dragging !== e.pointerId) return
      localRuntime.cameraYaw -= (e.clientX - lastX) * DRAG_SENSITIVITY
      lastX = e.clientX
    }
    const up = (e: PointerEvent) => {
      if (dragging === e.pointerId) dragging = null
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gl])

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const rt = localRuntime
    rt.cameraYaw += readOrbitInput() * ORBIT_SPEED * dt

    const p = rt.position
    const nearFire = 1 - smoothstep(CAMERA.nearFireRadius, CAMERA.nearFireRadius + 5, Math.hypot(p.x, p.z))
    const dist = CAMERA.distance + (CAMERA.nearFireDistance - CAMERA.distance) * nearFire
    const height = CAMERA.height + (CAMERA.nearFireHeight - CAMERA.height) * nearFire

    const d = desired.current
    d.set(p.x - Math.sin(rt.cameraYaw) * dist, p.y + height, p.z - Math.cos(rt.cameraYaw) * dist)
    d.y = Math.max(d.y, heightAt(d.x, d.z) + 0.8)

    if (!initialized.current) {
      camera.position.copy(d)
      look.current.set(p.x, p.y + CAMERA.lookHeight, p.z)
      initialized.current = true
    } else {
      camera.position.lerp(d, damp(CAMERA.followLerp, dt))
      look.current.x += (p.x - look.current.x) * damp(CAMERA.followLerp * 2, dt)
      look.current.y += (p.y + CAMERA.lookHeight - look.current.y) * damp(CAMERA.followLerp * 2, dt)
      look.current.z += (p.z - look.current.z) * damp(CAMERA.followLerp * 2, dt)
    }
    camera.lookAt(look.current)
  }, -1)

  return null
}
