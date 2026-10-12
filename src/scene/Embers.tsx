import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry } from 'three'
import { FIRE } from '../config'
import { getSoftDotTexture } from '../lib/textures'

// HDR ember color so bloom picks it up; fading is done by darkening (additive blending → invisible).
const EMBER = [2.4, 1.05, 0.35]

interface EmberData {
  pos: Float32Array
  speed: Float32Array
  phase: Float32Array
  drift: Float32Array
}

function resetEmber({ pos, speed, phase, drift }: EmberData, i: number) {
  speed[i] = 0.5 + Math.random() * 0.7
  phase[i] = Math.random() * Math.PI * 2
  drift[i * 2] = (Math.random() - 0.5) * 0.5
  drift[i * 2 + 1] = (Math.random() - 0.5) * 0.5
  pos[i * 3] = (Math.random() - 0.5) * 0.7
  pos[i * 3 + 1] = 0.4 + Math.random() * 0.4
  pos[i * 3 + 2] = (Math.random() - 0.5) * 0.7
}

function createEmbers() {
  const n = FIRE.emberCount
  const data: EmberData = {
    pos: new Float32Array(n * 3),
    speed: new Float32Array(n),
    phase: new Float32Array(n),
    drift: new Float32Array(n * 2),
  }
  const age = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    resetEmber(data, i)
    age[i] = Math.random() * FIRE.emberLifetime * data.speed[i] // stagger
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(data.pos, 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(n * 3), 3))
  return { geometry, data, age }
}

export function Embers() {
  const { geometry, data, age } = useMemo(() => createEmbers(), [])

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = clock.elapsedTime
    const { pos, speed, phase, drift } = data
    const col = geometry.attributes.color.array as Float32Array
    for (let i = 0; i < FIRE.emberCount; i++) {
      const ix = i * 3
      age[i] += dt
      if (age[i] > FIRE.emberLifetime * speed[i]) {
        age[i] = 0
        resetEmber(data, i)
      }
      pos[ix] += (drift[i * 2] + Math.sin(t * 2.3 + phase[i]) * 0.35) * dt
      pos[ix + 1] += FIRE.emberRiseSpeed * (1.4 - speed[i] * 0.5) * dt
      pos[ix + 2] += (drift[i * 2 + 1] + Math.cos(t * 1.9 + phase[i]) * 0.35) * dt

      const life = age[i] / (FIRE.emberLifetime * speed[i])
      const fade = (1 - life) * Math.min(1, life * 8) * (0.65 + 0.35 * Math.sin(t * 17 + phase[i]))
      col[ix] = EMBER[0] * fade
      col[ix + 1] = EMBER[1] * fade * (1 - life * 0.5)
      col[ix + 2] = EMBER[2] * fade * (1 - life)
    }
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.color.needsUpdate = true
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.09}
        map={getSoftDotTexture()}
        vertexColors
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
        fog={false}
        sizeAttenuation
      />
    </points>
  )
}
