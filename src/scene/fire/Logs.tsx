import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { CylinderGeometry, MeshStandardMaterial, RepeatWrapping, SphereGeometry, SRGBColorSpace, type Texture } from 'three'
import { SIMPLEX_3D } from '../../lib/glsl'
import { createRng } from '../../lib/random'
import { ASSETS } from '../assets'
import { fireState } from '../fireState'

const heat = { uTime: { value: 0 }, uHeat: { value: 1 } }

/**
 * Charred wood: bark texture darkened toward charcoal near the flames, with glowing
 * cracks (animated noise) where it is hottest.
 */
function createCharredMaterial(map: Texture, normalMap: Texture, hotness: number) {
  const m = new MeshStandardMaterial({ map, normalMap, roughness: 0.95, metalness: 0 })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = heat.uTime
    shader.uniforms.uHeat = heat.uHeat
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vFirePos;\nvoid main() {')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvFirePos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `varying vec3 vFirePos;\nuniform float uTime;\nuniform float uHeat;\n${SIMPLEX_3D}\nvoid main() {`,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
        float core = 1.0 - smoothstep(0.1, 0.75, length(vFirePos.xz)) * smoothstep(0.9, 0.2, vFirePos.y);
        float charred = clamp(core * 1.4 + ${(hotness * 0.4).toFixed(2)}, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.025, 0.022, 0.02), charred * 0.92);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        {
          float n = snoise(vFirePos * 9.0 + vec3(0.0, uTime * 0.15, 0.0));
          float cracks = pow(smoothstep(0.35, 0.95, n), 2.0);
          float pulse = 0.75 + 0.25 * sin(uTime * 2.0 + n * 6.0);
          float hot = core * ${hotness.toFixed(2)} * uHeat;
          totalEmissiveRadiance += vec3(3.2, 0.85, 0.15) * cracks * hot * pulse * 2.2;
          totalEmissiveRadiance += vec3(0.9, 0.18, 0.02) * hot * 0.08;
        }`,
      )
  }
  return m
}

/** Split logs in a loose teepee over a bed of glowing coals. */
export function Logs() {
  const tex = useTexture({ map: ASSETS.fir.logDiff, nor: ASSETS.fir.logNor })
  const { logMat, coalMat, logs, coals } = useMemo(() => {
    tex.map.colorSpace = SRGBColorSpace
    for (const t of [tex.map, tex.nor]) {
      t.wrapS = t.wrapT = RepeatWrapping
      t.repeat.set(1, 2)
    }
    const rand = createRng(77)
    const logs = Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + rand() * 0.3
      return {
        rotY: a,
        lean: 0.62 + rand() * 0.18,
        len: 1.05 + rand() * 0.3,
        r: 0.06 + rand() * 0.03,
      }
    })
    const coals = Array.from({ length: 26 }, () => {
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(rand()) * 0.5
      const s = 0.05 + rand() * 0.07
      return { p: [Math.cos(a) * r, 0.1 + rand() * 0.05, Math.sin(a) * r] as const, s, rot: rand() * 6 }
    })
    return {
      logMat: createCharredMaterial(tex.map, tex.nor, 0.9),
      coalMat: createCharredMaterial(tex.map, tex.nor, 1.6),
      logs,
      coals,
    }
  }, [tex])

  const logGeo = useMemo(() => new CylinderGeometry(1, 1, 1, 9, 4), [])
  const coalGeo = useMemo(() => new SphereGeometry(1, 7, 5), [])

  useFrame(({ clock }) => {
    heat.uTime.value = clock.elapsedTime
    heat.uHeat.value = 0.8 + (fireState.flicker - 1) * 0.8
  })

  return (
    <group>
      {logs.map((l, i) => (
        <group key={i} rotation={[0, l.rotY, 0]}>
          <mesh
            geometry={logGeo}
            material={logMat}
            position={[0, 0.38, 0.36]}
            rotation={[-l.lean, 0, 0]}
            scale={[l.r, l.len, l.r]}
            castShadow
            receiveShadow
          />
        </group>
      ))}
      {coals.map((c, i) => (
        <mesh
          key={`c${i}`}
          geometry={coalGeo}
          material={coalMat}
          position={c.p as unknown as [number, number, number]}
          rotation={[c.rot, c.rot * 2, 0]}
          scale={[c.s * 1.4, c.s * 0.6, c.s]}
        />
      ))}
    </group>
  )
}
