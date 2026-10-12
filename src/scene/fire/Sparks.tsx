import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, ShaderMaterial } from 'three'
import { FIRE } from '../../config'

const LIFE = 2.6

/** Sparks that shoot up from the fire, flicker, cool from white-yellow to red and die. GPU animated. */
function createSparks() {
  const n = FIRE.sparkCount
  const seeds = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    seeds[i * 4] = Math.random() // age offset
    seeds[i * 4 + 1] = Math.random() * 100 // phase
    seeds[i * 4 + 2] = 0.5 + Math.random() * 1.0 // speed
    seeds[i * 4 + 3] = Math.random() // lifetime scale
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(n * 3), 3))
  geo.setAttribute('aSeed', new Float32BufferAttribute(seeds, 4))
  const material = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 800 } },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime;
      uniform float uScale;
      varying vec3 vColor;
      void main() {
        float life = ${LIFE.toFixed(1)} * (0.5 + aSeed.w * 0.7);
        float cycle = uTime / life + aSeed.x;
        float age = fract(cycle);
        float id = floor(cycle) + aSeed.y;
        float a = fract(sin(id * 12.9898) * 43758.5453) * 6.2831;
        float r0 = fract(sin(id * 78.233) * 12345.678) * 0.35;
        vec3 p = vec3(cos(a) * r0, 0.5, sin(a) * r0);
        float t = age * life;
        p.y += t * aSeed.z * 1.9 - t * t * 0.18;
        p.x += sin(t * 3.0 + aSeed.y) * 0.25 * t + cos(a) * t * 0.25 + t * 0.15;
        p.z += cos(t * 2.6 + aSeed.y) * 0.25 * t + sin(a) * t * 0.25;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float heat = 1.0 - age;
        float flick = 0.6 + 0.4 * sin(uTime * 30.0 + aSeed.y * 7.0);
        vColor = mix(vec3(1.2, 0.18, 0.02), vec3(3.5, 2.2, 0.9), heat * heat) * heat * flick * 3.0;
        gl_PointSize = max(1.5, 0.035 * uScale / -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor * a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  return { geo, material }
}

export function Sparks() {
  const { geo, material } = useMemo(() => createSparks(), [])
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uScale.value = size.height * dpr
  })
  return <points geometry={geo} material={material} frustumCulled={false} renderOrder={12} />
}
