import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { TERRAIN } from '../config'
import { SUN_SHADOW_URL, world } from '../world/worldData'
import { enabled } from '../lib/debug'
import { FarForest } from './Impostors'
import { TERRAIN_GLSL, terrainUniforms } from './terrainShading'

const BASE = '/assets/riffelalp/'

/**
 * The real landscape around camp out to 26 km, as a polar mesh centred on the fire:
 * rings are log-spaced so detail is constant on screen. Heights are swissALTI3D (2 m)
 * near camp and on the Matterhorn, Terrain Tiles elsewhere.
 */
function buildPolarGeometry() {
  const { polar, meta } = world()
  const { na, nr, r0, rMax, heightScale, campAltitude } = meta
  const cols = na + 1 // duplicate the first column so the texture wraps cleanly
  const pos = new Float32Array(cols * nr * 3)
  const uv = new Float32Array(cols * nr * 2)
  for (let k = 0; k < nr; k++) {
    const v = k / (nr - 1)
    const r = r0 * (rMax / r0) ** v
    for (let c = 0; c < cols; c++) {
      const a = c % na
      const b = (c / na) * Math.PI * 2
      const i = k * cols + c
      pos[i * 3] = Math.sin(b) * r // east
      pos[i * 3 + 1] = polar[k * na + a] * heightScale - campAltitude
      pos[i * 3 + 2] = -Math.cos(b) * r // south
      uv[i * 2] = c / na
      uv[i * 2 + 1] = v
    }
  }
  const index = new Uint32Array((cols - 1) * (nr - 1) * 6)
  let o = 0
  for (let k = 0; k < nr - 1; k++)
    for (let c = 0; c < cols - 1; c++) {
      const a = k * cols + c
      const b = a + 1
      const d = a + cols
      const e = d + 1
      index[o++] = a
      index[o++] = b
      index[o++] = d
      index[o++] = b
      index[o++] = e
      index[o++] = d
    }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('uv', new BufferAttribute(uv, 2))
  g.setIndex(new BufferAttribute(index, 1))
  return g
}

function createTerrainMaterial() {
  return new ShaderMaterial({
    uniforms: {
      ...terrainUniforms,
      uOrtho: { value: null },
      uNormals: { value: null },
      uDelight: { value: TERRAIN.delight },
      // the aerial photos were flown around late morning: sun high in the south-east
      uPhotoSun: { value: new Vector3(0.45, 0.78, 0.43).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      varying float vAltitude;
      uniform float uCampAltitude;
      void main() {
        vUv = uv;
        vAltitude = position.y + uCampAltitude;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uOrtho;
      uniform sampler2D uNormals;
      uniform sampler2D uShadow;
      uniform float uDelight;
      uniform vec3 uPhotoSun;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying float vAltitude;
      ${TERRAIN_GLSL}
      void main() {
        vec3 albedo = texture2D(uOrtho, vUv).rgb;
        vec3 n = normalize(texture2D(uNormals, vUv).rgb * 2.0 - 1.0);
        // Remove part of the midday shading baked into the aerial photos.
        float photoShade = mix(0.42, 1.18, clamp(dot(n, uPhotoSun), 0.0, 1.0));
        albedo = clamp(albedo / mix(1.0, photoShade, uDelight), 0.0, 0.92);
        // keep bright scree and rock from reading as snow; real snow/ice stays bright
        float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
        float snowy = smoothstep(0.62, 0.78, lum) * smoothstep(2800.0, 3200.0, vAltitude);
        albedo = mix(albedo * mix(1.0, 0.82, smoothstep(0.45, 0.7, lum)), albedo, snowy);

        float sunVis = texture2D(uShadow, vUv).r;
        float ndl = max(dot(n, uSunDir), 0.0);
        vec3 color = albedo * (uSunColor * ndl * sunVis + skyLight(n));

        vec3 toFrag = vWorld - cameraPosition;
        float len = max(length(toFrag), 1e-5);
        float dist = len / uScale;
        color = aerialPerspective(color, toFrag / len, dist, vAltitude);
        gl_FragColor = vec4(color, 1.0);
        gl_FragDepth = terrainDepth(dist);
      }`,
  })
}

/**
 * Drawn as a scaled copy centred on the camera: every point appears in exactly the
 * direction the real one would, and depth is placed behind the local scene.
 */
export function AlpineTerrain() {
  const group = useRef<Group>(null!)
  const tex = useTexture({ ortho: BASE + 'ortho.jpg', normals: BASE + 'normals.jpg', shadow: SUN_SHADOW_URL })
  const geometry = useMemo(() => buildPolarGeometry(), [])
  const material = useMemo(() => createTerrainMaterial(), [])

  useEffect(() => {
    tex.ortho.colorSpace = SRGBColorSpace
    tex.normals.colorSpace = NoColorSpace
    tex.shadow.colorSpace = NoColorSpace
    for (const t of Object.values(tex)) {
      t.anisotropy = 16
      t.minFilter = LinearMipmapLinearFilter
      t.magFilter = LinearFilter
      t.needsUpdate = true
    }
    material.uniforms.uOrtho.value = tex.ortho
    material.uniforms.uNormals.value = tex.normals
    terrainUniforms.uShadow.value = tex.shadow
    material.uniforms.uShadow = terrainUniforms.uShadow
  }, [tex, material])

  useFrame(({ camera }) => {
    group.current.position.copy(camera.position).multiplyScalar(1 - TERRAIN.scale)
  })

  return (
    <group ref={group} scale={TERRAIN.scale}>
      {/* drawn after the local scene so pixels hidden behind trees are skipped */}
      <mesh geometry={geometry} material={material} renderOrder={1} frustumCulled={false} />
      {enabled('farforest') && <FarForest />}
    </group>
  )
}
