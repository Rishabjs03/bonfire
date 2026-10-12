import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, type Camera } from 'three'
import { CAMERA } from '../config'
import { VIEW_DIR } from '../world/directions'
import { damp, smoothstep } from '../lib/math'
import { heightAt } from '../lib/terrain'
import { localRuntime, useGameStore } from '../store/gameStore'
import { readOrbitInput } from './useControls'

const DRAG_SENSITIVITY = 0.005
const INTRO_BASE = Math.atan2(-VIEW_DIR.x, -VIEW_DIR.z)
const introTarget = new Vector3()
const introLook = new Vector3(VIEW_DIR.x * 7, 2.4, VIEW_DIR.z * 7)

/** Behind the join screen: a slow drift around the fire, the Matterhorn beyond it. */
function introShot(camera: Camera, t: number, dt: number, look: Vector3, initialized: boolean) {
  const a = INTRO_BASE + Math.sin(t * 0.045) * 0.55
  const r = 8.5 + Math.sin(t * 0.07) * 1.2
  introTarget.set(Math.sin(a) * r, 0, Math.cos(a) * r)
  introTarget.y = heightAt(introTarget.x, introTarget.z) + 1.9
  if (!initialized) {
    camera.position.copy(introTarget)
    look.copy(introLook)
  }
  camera.position.lerp(introTarget, damp(1.5, dt))
  look.lerp(introLook, damp(1.5, dt))
  camera.lookAt(look)
}
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

  useFrame(({ camera, clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const rt = localRuntime
    if (useGameStore.getState().phase !== 'joined') {
      introShot(camera, clock.elapsedTime, dt, look.current, initialized.current)
      initialized.current = true
      return
    }
    rt.cameraYaw += readOrbitInput() * ORBIT_SPEED * dt

    const p = rt.position
    const nearFire = 1 - smoothstep(CAMERA.nearFireRadius, CAMERA.nearFireRadius + 5, Math.hypot(p.x, p.z))
    const dist = CAMERA.distance + (CAMERA.nearFireDistance - CAMERA.distance) * nearFire
    const height = CAMERA.height + (CAMERA.nearFireHeight - CAMERA.height) * nearFire

    const d = desired.current
    const sx = -Math.cos(rt.cameraYaw) * CAMERA.shoulderOffset
    const sz = Math.sin(rt.cameraYaw) * CAMERA.shoulderOffset
    d.set(p.x - Math.sin(rt.cameraYaw) * dist + sx, p.y + height, p.z - Math.cos(rt.cameraYaw) * dist + sz)
    d.y = Math.max(d.y, heightAt(d.x, d.z) + 0.8)

    if (!initialized.current) {
      camera.position.copy(d)
      look.current.set(p.x + sx, p.y + CAMERA.lookHeight, p.z + sz)
      initialized.current = true
    } else {
      camera.position.lerp(d, damp(CAMERA.followLerp, dt))
      look.current.x += (p.x + sx - look.current.x) * damp(CAMERA.followLerp * 2, dt)
      look.current.y += (p.y + CAMERA.lookHeight - look.current.y) * damp(CAMERA.followLerp * 2, dt)
      look.current.z += (p.z + sz - look.current.z) * damp(CAMERA.followLerp * 2, dt)
    }
    camera.lookAt(look.current)
  }, -1)

  return null
}
