import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { PointLight } from 'three'
import { FIRE } from '../config'
import { enabled } from '../lib/debug'
import { ASSETS } from './assets'
import { FireVolume } from './fire/FireVolume'
import { Logs } from './fire/Logs'
import { Smoke } from './fire/Smoke'
import { Sparks } from './fire/Sparks'
import { fireState } from './fireState'

/** Layered sines with incommensurate frequencies: cheap smooth flicker noise. */
const flicker = (t: number) =>
  Math.sin(t * 8.3) * 0.45 + Math.sin(t * 13.7 + 1.3) * 0.3 + Math.sin(t * 23.1 + 0.7) * 0.15 + Math.sin(t * 3.1) * 0.1

function FirePit() {
  const { scene } = useGLTF(ASSETS.firePit)
  scene.traverse((o) => {
    o.castShadow = true
    o.receiveShadow = true
  })
  return <primitive object={scene} scale={FIRE.pitScale} />
}

function FireLight() {
  const light = useRef<PointLight>(null!)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * FIRE.flickerSpeed
    const n = flicker(t * 0.9) * 0.7 + Math.sin(t * 31.0) * 0.1 + (Math.random() - 0.5) * 0.15
    fireState.flicker = 1 + n * FIRE.flickerAmount
    light.current.intensity = FIRE.lightIntensity * fireState.flicker
    light.current.position.set(Math.sin(t * 3.1) * 0.06, FIRE.lightHeight + n * 0.05, Math.cos(t * 2.7) * 0.06)
    fireState.position.copy(light.current.position)
  })
  return (
    <pointLight
      ref={light}
      color={FIRE.lightColor}
      intensity={FIRE.lightIntensity}
      decay={2}
      distance={0}
    />
  )
}

export function Bonfire() {
  return (
    <group>
      <FirePit />
      <Logs />
      {enabled('flames') && <FireVolume />}
      {enabled('smoke') && <Smoke />}
      <Sparks />
      <FireLight />
    </group>
  )
}
