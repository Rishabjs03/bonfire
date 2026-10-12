import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { SNOW } from '../config'
import { getSoftDotTexture } from '../lib/textures'

function createSnowflakes() {
  const positions = new Float32Array(SNOW.count * 3)
  const speeds = new Float32Array(SNOW.count)
  const phases = new Float32Array(SNOW.count)
  for (let i = 0; i < SNOW.count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * SNOW.area
    positions[i * 3 + 1] = Math.random() * SNOW.height
    positions[i * 3 + 2] = (Math.random() - 0.5) * SNOW.area
    speeds[i] = 0.6 + Math.random() * 0.8
    phases[i] = Math.random() * Math.PI * 2
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return { geometry, speeds, phases }
}

/** Light snowfall in a box that wraps around the camera, so particles are endlessly recycled. */
export function Snow() {
  const { geometry, speeds, phases } = useMemo(() => createSnowflakes(), [])

  useFrame(({ camera, clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = clock.elapsedTime
    const arr = geometry.attributes.position.array as Float32Array
    const half = SNOW.area / 2
    const cx = camera.position.x
    const cz = camera.position.z
    const bottom = camera.position.y - SNOW.height * 0.5
    for (let i = 0; i < SNOW.count; i++) {
      const ix = i * 3
      arr[ix + 1] -= SNOW.fallSpeed * speeds[i] * dt
      arr[ix] += Math.sin(t * 0.6 + phases[i]) * SNOW.drift * dt
      arr[ix + 2] += Math.cos(t * 0.5 + phases[i]) * SNOW.drift * 0.6 * dt
      if (arr[ix + 1] < bottom) arr[ix + 1] += SNOW.height
      else if (arr[ix + 1] > bottom + SNOW.height) arr[ix + 1] -= SNOW.height
      if (arr[ix] - cx > half) arr[ix] -= SNOW.area
      else if (arr[ix] - cx < -half) arr[ix] += SNOW.area
      if (arr[ix + 2] - cz > half) arr[ix + 2] -= SNOW.area
      else if (arr[ix + 2] - cz < -half) arr[ix + 2] += SNOW.area
    }
    geometry.attributes.position.needsUpdate = true
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={SNOW.size}
        map={getSoftDotTexture()}
        color="#dfe8ff"
        transparent
        opacity={0.85}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}
