import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { DirectionalLight, Euler, Object3D } from 'three'
import { SKY, SUN } from '../config'
import { localRuntime } from '../store/gameStore'
import { useQuality } from '../store/quality'
import { SKY_ROTATION_Y, SUN_DIR } from '../world/directions'
import { world } from '../world/worldData'
import { FAR_LAYER } from './layers'

const skyRotation = new Euler(0, SKY_ROTATION_Y, 0)

/** Is the sun above the real skyline as seen from the fire? (baked with the terrain) */
const { sun } = world().meta
export const CAMP_IN_SUN = (sun.campHorizon ?? -90) < sun.elevation

/** The low evening sun, with a shadow frustum that follows the player. */
function Sunlight() {
  if (!CAMP_IN_SUN) return null // the mountainside still shades the meadow
  return <SunlightInner />
}

function SunlightInner() {
  const light = useRef<DirectionalLight>(null!)
  const mapSize = useQuality((q) => q.settings.shadowMapSize)
  const range = useQuality((q) => q.settings.shadowRange)
  const target = useMemo(() => new Object3D(), [])
  const scene = useThree((s) => s.scene)
  const frame = useRef(0)

  useEffect(() => {
    scene.add(target)
    const l = light.current
    l.target = target
    const cam = l.shadow.camera
    const r = range
    l.shadow.mapSize.set(mapSize, mapSize)
    l.shadow.map?.dispose()
    l.shadow.map = null
    cam.left = -r
    cam.right = r
    cam.top = r
    cam.bottom = -r
    cam.near = 1
    cam.far = SUN.shadowDepth
    cam.layers.enable(FAR_LAYER)
    cam.updateProjectionMatrix()
    return () => {
      scene.remove(target)
    }
  }, [scene, target, mapSize, range])

  useFrame(() => {
    // The forest doesn't move: refreshing the big shadow map every other frame is plenty.
    light.current.shadow.autoUpdate = false
    if (frame.current++ % 2 === 0) light.current.shadow.needsUpdate = true
    const p = localRuntime.position
    const step = (range * 2) / mapSize
    const x = Math.round(p.x / step) * step
    const z = Math.round(p.z / step) * step
    target.position.set(x, p.y, z)
    const d = SUN.shadowDepth * 0.8
    light.current.position.set(x + SUN_DIR.x * d, p.y + SUN_DIR.y * d, z + SUN_DIR.z * d)
  })

  return (
    <directionalLight
      ref={light}
      color={SUN.color}
      intensity={SUN.intensity}
      castShadow
      shadow-bias={-0.0003}
      shadow-normalBias={0.06}
    />
  )
}

/** A real clear-sky golden-hour sky (HDRI) lighting the scene, rotated so its sun is where the real one is. */
export function Sky() {
  return (
    <>
      <Environment
        files={SKY.hdr}
        background
        backgroundIntensity={SKY.backgroundIntensity}
        environmentIntensity={SKY.environmentIntensity * (CAMP_IN_SUN ? 1 : 0.7)}
        backgroundRotation={skyRotation}
        environmentRotation={skyRotation}
      />
      <Sunlight />
    </>
  )
}
