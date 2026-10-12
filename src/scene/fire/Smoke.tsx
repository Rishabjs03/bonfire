import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { InstancedBufferAttribute, InstancedBufferGeometry, PlaneGeometry, ShaderMaterial } from 'three'
import { FIRE } from '../../config'
import { SIMPLEX_3D } from '../../lib/glsl'
import { fireState } from '../fireState'

const LIFE = 7.5

/** Camera-facing smoke puffs, rising and spreading, lit orange from below by the fire. */
function createSmoke() {
  const base = new PlaneGeometry(1, 1)
  const geo = new InstancedBufferGeometry()
  geo.index = base.index
  geo.setAttribute('position', base.attributes.position)
  geo.setAttribute('uv', base.attributes.uv)
  const seeds = new Float32Array(FIRE.smokeCount * 3)
  for (let i = 0; i < FIRE.smokeCount; i++) {
    seeds[i * 3] = i / FIRE.smokeCount // age offset
    seeds[i * 3 + 1] = Math.random() * 100
    seeds[i * 3 + 2] = 0.7 + Math.random() * 0.6
  }
  geo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 3))
  geo.instanceCount = FIRE.smokeCount

  const material = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFire: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aSeed;
      uniform float uTime;
      varying vec2 vUv;
      varying float vAge;
      varying float vSeed;
      varying float vNear;
      void main() {
        float age = fract(uTime / ${LIFE.toFixed(1)} + aSeed.x);
        vAge = age;
        vSeed = aSeed.y;
        vec3 center = vec3(0.0, 1.4 + age * 7.0 * aSeed.z, 0.0);
        center.x += sin(aSeed.y + age * 3.0) * age * 1.2 + age * age * 2.2;
        center.z += cos(aSeed.y * 1.3 + age * 2.4) * age * 1.0;
        float size = (0.5 + age * 3.2) * aSeed.z;
        vec4 mv = viewMatrix * vec4(center, 1.0);
        // puffs right in front of the lens would smear across the screen: fade them
        vNear = smoothstep(1.2, 3.5, -mv.z);
        float rot = aSeed.y + age * 0.8;
        vec2 corner = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * position.xy * size;
        mv.xy += corner;
        vUv = uv;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uFire;
      varying vec2 vUv;
      varying float vAge;
      varying float vSeed;
      varying float vNear;
      ${SIMPLEX_3D}
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        float n = fbm3(vec3(p * 2.6, vSeed + uTime * 0.12));
        float puff = smoothstep(1.0, 0.25, r + n * 0.45);
        float life = smoothstep(0.0, 0.15, vAge) * (1.0 - smoothstep(0.45, 1.0, vAge));
        float alpha = puff * life * 0.13 * vNear;
        if (alpha < 0.003) discard;
        // lit from below by the fire, fading into the cold night above
        // daylight smoke: warm grey, lit by the low sun, a little fire glow at its root
        vec3 fireLit = vec3(1.0, 0.42, 0.14) * (1.0 - smoothstep(0.0, 0.2, vAge)) * uFire * 0.25;
        vec3 col = mix(vec3(0.42, 0.4, 0.4), vec3(0.62, 0.55, 0.48), vAge) + fireLit;
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true,
    depthWrite: false,
  })
  return { geo, material }
}

export function Smoke() {
  const { geo, material } = useMemo(() => createSmoke(), [])
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uFire.value = fireState.flicker
  })
  return <mesh geometry={geo} material={material} frustumCulled={false} renderOrder={11} />
}
