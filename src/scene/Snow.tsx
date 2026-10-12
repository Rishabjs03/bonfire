import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BufferGeometry, Float32BufferAttribute, ShaderMaterial } from 'three'
import { SNOW } from '../config'
import { fireState } from './fireState'

function createSnowflakes() {
  const positions = new Float32Array(SNOW.count * 3)
  const seeds = new Float32Array(SNOW.count * 2)
  for (let i = 0; i < SNOW.count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * SNOW.area
    positions[i * 3 + 1] = Math.random() * SNOW.height
    positions[i * 3 + 2] = (Math.random() - 0.5) * SNOW.area
    seeds[i * 2] = 0.5 + Math.random() * 0.9 // fall speed / size
    seeds[i * 2 + 1] = Math.random() * Math.PI * 2 // phase
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new Float32BufferAttribute(seeds, 2))
  return geometry
}

/**
 * Snow is animated entirely on the GPU: each flake falls through a box that wraps
 * around the camera. Flakes catch the fire's light and the cool moonlight.
 */
const material = new ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uCam: { value: [0, 0, 0] },
    uFirePos: { value: fireState.position },
    uFireFlicker: { value: 1 },
    uPixelRatio: { value: 1 },
    uViewportHeight: { value: 800 },
  },
  vertexShader: /* glsl */ `
    attribute vec2 aSeed;
    uniform float uTime;
    uniform vec3 uCam;
    uniform vec3 uFirePos;
    uniform float uFireFlicker;
    uniform float uPixelRatio;
    uniform float uViewportHeight;
    varying vec3 vColor;
    varying float vAlpha;
    const float AREA = ${SNOW.area.toFixed(1)};
    const float HEIGHT = ${SNOW.height.toFixed(1)};
    void main() {
      vec3 p = position;
      float speed = aSeed.x;
      p.y -= uTime * ${SNOW.fallSpeed.toFixed(2)} * speed;
      p.x += sin(uTime * 0.6 + aSeed.y) * ${SNOW.drift.toFixed(2)} + uTime * 0.12;
      p.z += cos(uTime * 0.47 + aSeed.y * 1.3) * ${SNOW.drift.toFixed(2)};
      // wrap into a box around the camera
      vec3 base = uCam - vec3(AREA * 0.5, HEIGHT * 0.45, AREA * 0.5);
      p = base + mod(p - base, vec3(AREA, HEIGHT, AREA));

      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float dist = -mv.z;
      float size = 0.012 + speed * 0.012; // metres
      gl_PointSize = max(1.0, size * uViewportHeight * uPixelRatio / dist * 1.2);

      vec3 toFire = uFirePos - p;
      float fireLight = uFireFlicker * 9.0 / (1.0 + dot(toFire, toFire));
      vColor = vec3(0.32, 0.38, 0.5) + vec3(1.0, 0.5, 0.2) * fireLight;
      vAlpha = smoothstep(0.7, 2.2, dist) * (1.0 - smoothstep(14.0, 20.0, dist));
    }`,
  fragmentShader: /* glsl */ `
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.15, d) * vAlpha;
      if (a < 0.01) discard;
      gl_FragColor = vec4(vColor, a * 0.85);
    }`,
  transparent: true,
  depthWrite: false,
})

export function Snow() {
  const geometry = useMemo(() => createSnowflakes(), [])
  const { size, viewport } = useThree()

  useFrame(({ camera, clock }) => {
    const u = material.uniforms
    u.uTime.value = clock.elapsedTime
    u.uCam.value = [camera.position.x, camera.position.y, camera.position.z]
    u.uFireFlicker.value = fireState.flicker
    u.uPixelRatio.value = viewport.dpr
    u.uViewportHeight.value = size.height
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}
