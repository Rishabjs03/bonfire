import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import { GRASS, WORLD } from '../config'
import { heightAt } from '../lib/terrain'
import { useQuality, QUALITY } from '../store/quality'
import { canopyTexture, GROUND_GLSL, heightTexture } from '../world/groundData'

const SEGMENTS = 4

/** One blade: a tapered strip, base at y = 0, tip at y = 1, width 1. */
function bladeGeometry() {
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i < SEGMENTS; i++) {
    const t = i / SEGMENTS
    const w = 0.5 * (1 - t * 0.85)
    pos.push(-w, t, 0, w, t, 0)
  }
  pos.push(0, 1, 0)
  for (let i = 0; i < SEGMENTS - 1; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const last = (SEGMENTS - 1) * 2
  idx.push(last, last + 1, last + 2)
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setIndex(idx)
  return g
}

function createGrass() {
  const base = bladeGeometry()
  const g = new InstancedBufferGeometry()
  g.index = base.index
  g.setAttribute('position', base.attributes.position)
  const n = QUALITY[2].grassCount // allocate for the highest level; draw fewer when needed
  const cell = new Float32Array(n * 2)
  const rnd = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    cell[i * 2] = Math.random()
    cell[i * 2 + 1] = Math.random()
    for (let k = 0; k < 4; k++) rnd[i * 4 + k] = Math.random()
  }
  g.setAttribute('aCell', new InstancedBufferAttribute(cell, 2))
  g.setAttribute('aRand', new InstancedBufferAttribute(rnd, 4))
  g.instanceCount = n
  return g
}

const uniforms = {
  uRadius: { value: GRASS.radius },
  uTime: { value: 0 },
  uCam: { value: new Vector3() },
  uHeights: { value: heightTexture },
  uCanopy: { value: canopyTexture },
  uPit: { value: heightAt(0, 0) },
}

function createGrassMaterial() {
  const m = new MeshStandardMaterial({ side: DoubleSide, roughness: 0.75, metalness: 0 })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        /* glsl */ `attribute vec2 aCell;
        attribute vec4 aRand;
        uniform float uTime;
        uniform vec3 uCam;
        uniform float uPit;
        uniform float uRadius;
        varying vec3 vGrassColor;
        varying float vTip;
        ${GROUND_GLSL}
        void main() {`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        /* glsl */ `
        // Blades are fixed in the world; the field just wraps around the camera.
        float SIDE = uRadius * 2.0;
        vec2 baseXZ = uCam.xz - SIDE * 0.5;
        vec2 xz = baseXZ + mod(aCell * SIDE - baseXZ, SIDE);
        float distCam = length(xz - uCam.xz);
        float fromFire = length(xz);
        float cover = canopy(xz);
        // thinning: with distance, in the shade of trees, and trodden around the fire
        float keep = 1.0 - smoothstep(uRadius * 0.5, uRadius, distCam);
        keep *= 1.0 - smoothstep(0.35, 0.8, cover);
        keep *= smoothstep(1.7, 3.6, fromFire);
        float alive = step(aRand.z, keep);
        float clump = 0.65 + 0.35 * sin(xz.x * 0.21 + sin(xz.y * 0.17) * 1.7) * sin(xz.y * 0.19 + 1.3);
        bool flower = aRand.w < ${GRASS.flowerShare.toFixed(3)};
        float height = ${GRASS.height.toFixed(3)} * (0.45 + aRand.x * 0.9) * clump * (flower ? 0.75 : 1.0) * alive;
        float width = ${GRASS.width.toFixed(3)} * (0.7 + aRand.y * 0.6) * (1.0 + distCam * 0.03);
        float angle = aRand.y * 6.2831853;
        vec2 facing = vec2(cos(angle), sin(angle));
        // wind: travelling gusts plus flutter, bending more toward the tip
        float t = position.y;
        float gust = sin(uTime * 1.3 + xz.x * 0.22 + xz.y * 0.13) * 0.6 + sin(uTime * 2.9 + xz.x * 0.7 - xz.y * 0.4) * 0.25;
        float bend = (0.25 + aRand.x * 0.3 + gust * 0.35) * t * t;
        vec2 windDir = normalize(vec2(0.8, 0.35));
        vec3 local = vec3(facing * position.x * width, 0.0).xzy;
        local.y = t * height;
        local.xz += (windDir * bend + facing.yx * vec2(-1.0, 1.0) * aRand.z * 0.15 * t) * height;
        float ground = groundHeight(xz, uPit, ${WORLD.firePitFlatten.toFixed(2)});
        vec3 grassPos = vec3(xz.x, ground, xz.y) + local;
        vec3 objectNormal = normalize(vec3(facing.y, 1.4, -facing.x) * vec3(1.0, 1.0, 1.0) + vec3(windDir.x, 0.0, windDir.y) * 0.3);
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(1.0, 0.0, 0.0);
        #endif
        // late-summer alpine grass: green at the base, straw-gold tips; a few flowers
        vec3 baseCol = mix(vec3(0.10, 0.14, 0.04), vec3(0.15, 0.17, 0.05), aRand.x);
        vec3 tipCol = mix(vec3(0.42, 0.45, 0.16), vec3(0.62, 0.52, 0.22), aRand.z * clump);
        vGrassColor = mix(baseCol, tipCol, t);
        if (flower && t > 0.82) {
          vec3 petals[4] = vec3[4](vec3(0.55, 0.32, 0.75), vec3(0.95, 0.82, 0.18), vec3(0.92, 0.92, 0.88), vec3(0.32, 0.38, 0.85));
          vGrassColor = petals[int(aRand.y * 3.99)];
        }
        vTip = t;`,
      )
      .replace('#include <begin_vertex>', 'vec3 transformed = grassPos;')
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'varying vec3 vGrassColor;\nvarying float vTip;\nvoid main() {')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = vGrassColor;')
      // light shining through thin blades when you look toward the low sun
      .replace(
        '#include <lights_fragment_end>',
        /* glsl */ `#include <lights_fragment_end>
        #if NUM_DIR_LIGHTS > 0
        {
          vec3 L = directionalLights[0].direction;
          vec3 V = normalize(vViewPosition);
          float back = pow(max(dot(-V, L), 0.0), 4.0) * vTip;
          reflectedLight.directDiffuse += diffuseColor.rgb * directionalLights[0].color * back * 0.8;
        }
        #endif`,
      )
  }
  return m
}

/** Wind-blown alpine meadow grass and wildflowers around the camera. */
export function Grass() {
  const geometry = useMemo(() => createGrass(), [])
  const material = useMemo(() => createGrassMaterial(), [])
  const count = useQuality((q) => q.settings.grassCount)
  const radius = useQuality((q) => q.settings.grassRadius)
  // fewer blades over a smaller patch keeps the same density near you
  geometry.instanceCount = count
  uniforms.uRadius.value = radius
  useFrame(({ camera, clock }) => {
    uniforms.uTime.value = clock.elapsedTime
    uniforms.uCam.value.copy(camera.position)
  })
  return <mesh geometry={geometry} material={material} frustumCulled={false} receiveShadow />
}
