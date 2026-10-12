import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Color, Float32BufferAttribute, Group, MeshStandardMaterial, Vector3 } from 'three'
import { FOG, TERRAIN } from '../config'
import { SIMPLEX_3D } from '../lib/glsl'
import { smoothstep } from '../lib/math'
import { MOON_DIR } from './moon'

interface Heightmap {
  half: number
  campAltitude: number
  size: number
  data: Uint16Array
}

async function loadHeightmap(url: string): Promise<Heightmap> {
  const buf = await (await fetch(url)).arrayBuffer()
  const header = new Float32Array(buf, 0, 4)
  const data = new Uint16Array(buf, 16)
  return { half: header[0], campAltitude: header[3], size: Math.round(Math.sqrt(data.length)), data }
}

/** Bilinear height (metres) at world x (east) / z (south), relative to nothing. */
function sampleHeight(hm: Heightmap, x: number, z: number) {
  const { half, size, data } = hm
  const fx = ((x + half) / (2 * half)) * size - 0.5
  const fy = ((z + half) / (2 * half)) * size - 0.5 // row 0 is north (z = -half)
  const ix = Math.max(0, Math.min(size - 2, Math.floor(fx)))
  const iy = Math.max(0, Math.min(size - 2, Math.floor(fy)))
  const ax = Math.min(1, Math.max(0, fx - ix))
  const ay = Math.min(1, Math.max(0, fy - iy))
  const i = iy * size + ix
  const top = data[i] * (1 - ax) + data[i + 1] * ax
  const bottom = data[i + size] * (1 - ax) + data[i + size + 1] * ax
  return top * (1 - ay) + bottom * ay
}

const SNOW = new Color('#e9eef7')
const ROCK = new Color('#3b3d42')
const FOREST = new Color('#1c2420')
const SNOWY_FOREST = new Color('#5d6670')

/** Build the terrain mesh in real metres, centred on camp (camp altitude = 0). */
function buildTerrain(hm: Heightmap, resolution: number) {
  const { half, campAltitude } = hm
  const n = resolution
  const step = (2 * half) / (n - 1)
  const positions = new Float32Array(n * n * 3)
  const heights = new Float32Array(n * n)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -half + i * step
      const z = -half + j * step
      const h = sampleHeight(hm, x, z)
      heights[j * n + i] = h
      const k = (j * n + i) * 3
      positions[k] = x
      positions[k + 1] = h - campAltitude
      positions[k + 2] = z
    }
  }

  const indices: number[] = []
  const hole2 = TERRAIN.holeRadius * TERRAIN.holeRadius
  const outside = (idx: number) => positions[idx * 3] ** 2 + positions[idx * 3 + 2] ** 2 > hole2
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i
      const b = a + 1
      const c = a + n
      const d = c + 1
      if (outside(a) && outside(b) && outside(c) && outside(d)) indices.push(a, c, b, b, c, d)
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()

  // Albedo from altitude and slope, plus baked moon self-shadowing.
  const normals = geo.attributes.normal.array as Float32Array
  const colors = new Float32Array(n * n * 3)
  const shadow = new Float32Array(n * n)
  const c = new Color()
  const ray = new Vector3()
  for (let v = 0; v < n * n; v++) {
    const alt = heights[v]
    const slope = 1 - normals[v * 3 + 1] // 0 flat .. 1 vertical
    const x = positions[v * 3]
    const z = positions[v * 3 + 2]
    const noise = Math.sin(x * 0.0071) * Math.cos(z * 0.0053) * 60 + Math.sin(x * 0.031 + z * 0.027) * 25

    const forest = 1 - smoothstep(TERRAIN.treeLine - 120, TERRAIN.treeLine + 80, alt + noise)
    const steep = smoothstep(0.16, 0.34, slope + noise * 0.0008)
    c.copy(SNOW).lerp(ROCK, steep)
    c.lerp(steep > 0.5 ? FOREST : SNOWY_FOREST, forest * (1 - steep * 0.5))
    if (forest > 0.5 && steep > 0.4) c.copy(FOREST)
    c.toArray(colors, v * 3)

    // March toward the moon over the heightmap.
    let lit = 1
    ray.set(x, alt, z)
    let dist = 40
    for (let s = 0; s < 48 && lit > 0; s++) {
      const px = x + MOON_DIR.x * dist
      const pz = z + MOON_DIR.z * dist
      if (Math.abs(px) > half || Math.abs(pz) > half) break
      const ry = alt + MOON_DIR.y * dist
      const h = sampleHeight(hm, px, pz)
      if (h > ry) lit = Math.max(0, lit - 0.5)
      dist *= 1.12
    }
    shadow[v] = lit
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geo.setAttribute('aShadow', new Float32BufferAttribute(shadow, 1))
  return geo
}

function createTerrainMaterial() {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, fog: false })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uHaze = { value: new Color(TERRAIN.haze) }
    shader.uniforms.uHazeDistance = { value: TERRAIN.hazeDistance * TERRAIN.scale }
    shader.uniforms.uMist = { value: new Color(FOG.color) }
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      `attribute float aShadow;
      varying float vShadow;
      varying vec3 vReal;
      varying vec3 vRealNormal;
      void main() {
        vShadow = aShadow;
        vReal = position;
        vRealNormal = normal;`,
    )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `varying float vShadow;
        varying vec3 vReal;
        varying vec3 vRealNormal;
        uniform vec3 uHaze;
        uniform vec3 uMist;
        uniform float uHazeDistance;
        ${SIMPLEX_3D}
        void main() {`,
      )
      // Rock vs snow per pixel: steep faces shed snow, with noisy gullies and ribs.
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        float detail = fbm3(vReal * 0.0038);
        float steepness = 1.0 - normalize(vRealNormal).y;
        float rock = smoothstep(0.2, 0.42, steepness + detail * 0.18);
        float forestish = step(diffuseColor.g, 0.2) * step(vReal.y, 250.0);
        vec3 rockCol = vec3(0.055, 0.057, 0.062) * (0.8 + 0.6 * detail);
        diffuseColor.rgb = mix(diffuseColor.rgb, rockCol, rock * (1.0 - forestish));`,
      )
      // Craggy relief from noise gradients.
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        {
          // bump from the same procedural height, via screen-space derivatives
          vec3 vSigmaX = dFdx(-vViewPosition);
          vec3 vSigmaY = dFdy(-vViewPosition);
          vec3 R1 = cross(vSigmaY, normal);
          vec3 R2 = cross(normal, vSigmaX);
          float fDet = dot(vSigmaX, R1);
          float hgt = detail * 1.6 * (1.0 - smoothstep(300.0, 1200.0, length(vViewPosition)));
          vec3 vGrad = sign(fDet) * (dFdx(hgt) * R1 + dFdy(hgt) * R2);
          normal = normalize(abs(fDet) * normal - vGrad);
        }`,
      )
      .replace(
        '#include <lights_fragment_end>',
        '#include <lights_fragment_end>\nreflectedLight.directDiffuse *= vShadow;',
      )
      .replace(
        '#include <dithering_fragment>',
        /* glsl */ `#include <dithering_fragment>
        float dist = length(vViewPosition);
        float haze = 1.0 - exp(-dist / uHazeDistance);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, haze * 0.6);
        // Nearby slopes dissolve into the forest mist, hiding where the local world takes over.
        float near = 1.0 - smoothstep(${TERRAIN.holeRadius.toFixed(1)}, ${(TERRAIN.holeRadius + 1600).toFixed(1)}, length(vReal.xz));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uMist, near * 0.97);`,
      )
  }
  return m
}

/**
 * The real Alps around Zermatt (AWS Terrain Tiles / SRTM-derived), drawn as a scaled
 * backdrop that moves with the camera, so the Matterhorn sits on the horizon.
 */
export function AlpineTerrain() {
  const group = useRef<Group>(null!)
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null)
  const material = useMemo(() => createTerrainMaterial(), [])

  useEffect(() => {
    let cancelled = false
    loadHeightmap(TERRAIN.url).then((hm) => {
      if (!cancelled) setGeometry(buildTerrain(hm, hm.size))
    })
    return () => {
      cancelled = true
    }
  }, [])

  useFrame(({ camera }) => {
    // Scaled copy centred on the camera: angular size is exactly as seen from camp.
    group.current.position.copy(camera.position).multiplyScalar(1 - TERRAIN.scale)
  })

  return (
    <group ref={group} scale={TERRAIN.scale}>
      {/* drawn after the local scene, so pixels hidden behind trees are skipped by the depth test */}
      {geometry && <mesh geometry={geometry} material={material} renderOrder={1} frustumCulled={false} />}
    </group>
  )
}
