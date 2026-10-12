import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import {
  Color,
  DoubleSide,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  Vector3,
} from 'three'
import { TREES } from '../config'
import { createFir, type FirGeometry } from '../lib/firTree'
import { FOREST, type TreeInstance } from '../lib/forest'
import { heightAt } from '../lib/terrain'
import { localRuntime, useGameStore } from '../store/gameStore'
import { ASSETS } from './assets'

const ORIGIN = new Vector3()

/** Heights of the pre-built tree variants; each tree uses the nearest and scales to fit. */
const VARIANT_HEIGHTS = [3, 5.5, 9, 13, 17, 21]
/** Mid-distance trees: cast moon shadows but not fire shadows. */
export const FAR_LAYER = 1
/** Distant trees: no shadows at all (they are deep in the fog anyway). */
export const DISTANT_LAYER = 2
type Tier = 'near' | 'far' | 'distant'

const shared = { uTime: { value: 0 }, uPlayerView: { value: new Vector3() } }

/**
 * Shader patch shared by foliage and bark: trees right next to the camera, or standing
 * between the camera and the player, dissolve with an ordered dither (no sorting needed).
 */
const DITHER_FADE = /* glsl */ `
  {
    float camDist = length(vViewPosition);
    float keep = smoothstep(${TREES.cameraFadeNear.toFixed(2)}, ${TREES.cameraFadeFar.toFixed(2)}, camDist);
    vec3 fragView = -vViewPosition;
    if (-fragView.z < -uPlayerView.z - 0.8) {
      vec2 a = fragView.xy / -fragView.z;
      vec2 b = uPlayerView.xy / -uPlayerView.z;
      vec2 d = (a - b) * vec2(1.0, 0.6); // taller than wide: keep the whole figure visible
      keep = min(keep, mix(0.12, 1.0, smoothstep(0.1, 0.22, length(d))));
    }
    if (keep < 0.999) {
      ivec2 p = ivec2(mod(gl_FragCoord.xy, 4.0));
      float bayer[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
      if (keep < (bayer[p.x + p.y * 4] + 0.5) / 16.0) discard;
    }
  }
`

function createFoliageMaterial(map: Texture, alphaMap: Texture) {
  const m = new MeshStandardMaterial({
    map,
    alphaMap,
    alphaTest: 0.42,
    alphaToCoverage: true,
    side: DoubleSide,
    vertexColors: true,
    roughness: 0.82,
    metalness: 0,
  })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime
    shader.uniforms.uPlayerView = shared.uPlayerView
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        /* glsl */ `attribute float aSnow;
        varying float vSnow;
        uniform float uTime;
        void main() {
          vSnow = aSnow;`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float phase = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
        #else
          float phase = 0.0;
        #endif
        float reach = length(position.xz);
        float sway = sin(uTime * 0.9 + phase + position.y * 0.15) * 0.5 + sin(uTime * 2.3 + phase * 1.7) * 0.2;
        transformed.x += sway * 0.012 * reach * (0.3 + position.y * 0.05);
        transformed.y += sin(uTime * 1.7 + phase + reach) * 0.006 * reach;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'varying float vSnow;\nuniform vec3 uPlayerView;\nvoid main() {')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${DITHER_FADE}`)
      .replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
        float needleLum = dot(diffuseColor.rgb, vec3(0.333));
        float snowMask = smoothstep(0.18, 0.55, vSnow + (needleLum - 0.22) * 0.9);
        diffuseColor.rgb = mix(diffuseColor.rgb * 0.8, vec3(0.80, 0.85, 0.93), snowMask);`,
      )
      // Cards use rounded crown normals: don't flip them on back faces.
      .replace(
        '#include <normal_fragment_begin>',
        /* glsl */ `float faceDirection = gl_FrontFacing ? 1.0 : -1.0;
        vec3 normal = normalize( vNormal );
        vec3 nonPerturbedNormal = normal;`,
      )
  }
  return m
}

function createBarkMaterial(map: Texture, normalMap: Texture) {
  const m = new MeshStandardMaterial({ map, normalMap, roughness: 0.95, metalness: 0, color: '#9a8f86' })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uPlayerView = shared.uPlayerView
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 uPlayerView;\nvoid main() {')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${DITHER_FADE}`)
  }
  return m
}

interface VariantProps {
  geometry: FirGeometry
  variantHeight: number
  trees: TreeInstance[]
  foliage: MeshStandardMaterial
  bark: MeshStandardMaterial
  tier: Tier
}

function TreeVariant({ geometry, variantHeight, trees, foliage, bark, tier }: VariantProps) {
  const foliageRef = useRef<InstancedMesh>(null!)
  const barkRef = useRef<InstancedMesh>(null!)

  useLayoutEffect(() => {
    if (trees.length === 0) return
    const dummy = new Object3D()
    const tint = new Color()
    trees.forEach((t, i) => {
      const s = t.height / variantHeight
      dummy.position.set(t.x, heightAt(t.x, t.z), t.z)
      dummy.rotation.set(0, t.rotation, 0)
      dummy.scale.set(s * (0.9 + (t.shade - 0.8) * 0.4), s, s * (0.9 + (t.shade - 0.8) * 0.4))
      dummy.updateMatrix()
      foliageRef.current.setMatrixAt(i, dummy.matrix)
      barkRef.current.setMatrixAt(i, dummy.matrix)
      foliageRef.current.setColorAt(i, tint.setScalar(t.shade))
    })
    for (const mesh of [foliageRef.current, barkRef.current]) {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
      if (tier === 'far') mesh.layers.set(FAR_LAYER)
      if (tier === 'distant') mesh.layers.set(DISTANT_LAYER)
    }
  }, [trees, variantHeight, tier])

  if (trees.length === 0) return null
  return (
    <>
      <instancedMesh
        ref={foliageRef}
        args={[geometry.foliage, foliage, trees.length]}
        castShadow={tier !== 'distant'}
        receiveShadow
      />
      <instancedMesh
        ref={barkRef}
        args={[geometry.bark, bark, trees.length]}
        castShadow={tier !== 'distant'}
        receiveShadow
      />
    </>
  )
}

export function Trees() {
  const tex = useTexture({
    twig: ASSETS.fir.twigDiff,
    alpha: ASSETS.fir.twigAlpha,
    bark: ASSETS.fir.barkDiff,
    barkNor: ASSETS.fir.barkNor,
  })

  const { foliage, bark } = useMemo(() => {
    tex.twig.colorSpace = SRGBColorSpace
    tex.bark.colorSpace = SRGBColorSpace
    for (const t of [tex.bark, tex.barkNor]) t.wrapS = t.wrapT = RepeatWrapping
    for (const t of Object.values(tex)) t.anisotropy = 8
    return { foliage: createFoliageMaterial(tex.twig, tex.alpha), bark: createBarkMaterial(tex.bark, tex.barkNor) }
  }, [tex])

  const variants = useMemo(
    () =>
      VARIANT_HEIGHTS.map((h, i) => ({
        full: createFir(h, 9001 + i * 31),
        low: createFir(h, 9001 + i * 31, true),
      })),
    [],
  )

  const groups = useMemo(() => {
    const out = VARIANT_HEIGHTS.map(() => ({ near: [], far: [], distant: [] }) as Record<Tier, TreeInstance[]>)
    for (const t of FOREST) {
      let best = 0
      for (let i = 1; i < VARIANT_HEIGHTS.length; i++) {
        if (Math.abs(VARIANT_HEIGHTS[i] - t.height) < Math.abs(VARIANT_HEIGHTS[best] - t.height)) best = i
      }
      const r = Math.hypot(t.x, t.z)
      out[best][r < TREES.shadowCasterRadius ? 'near' : r < TREES.moonShadowRadius ? 'far' : 'distant'].push(t)
    }
    return out
  }, [])

  useFrame(({ camera, clock }) => {
    shared.uTime.value = clock.elapsedTime
    // Before joining there's no player to keep in view: aim at the fire instead.
    const p = useGameStore.getState().phase === 'joined' ? localRuntime.position : ORIGIN
    shared.uPlayerView.value.set(p.x, p.y + 1.0, p.z).applyMatrix4(camera.matrixWorldInverse)
  })

  return (
    <group>
      {variants.map((variant, i) => (
        <group key={i}>
          {(['near', 'far', 'distant'] as const).map((tier) => (
            <TreeVariant
              key={tier}
              geometry={tier === 'distant' ? variant.low : variant.full}
              variantHeight={VARIANT_HEIGHTS[i]}
              trees={groups[i][tier]}
              foliage={foliage}
              bark={bark}
              tier={tier}
            />
          ))}
        </group>
      ))}
    </group>
  )
}
