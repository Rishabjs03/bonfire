import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { MeshStandardMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace, Vector2 } from 'three'
import { WORLD } from '../config'
import { heightAt } from '../lib/terrain'
import { ASSETS } from './assets'
import { fireState } from './fireState'
import { MOON_DIR } from './moon'

const TILE = 2.6 // metres per texture repeat

const uniforms = {
  uMoonDir: { value: MOON_DIR },
  uFirePos: { value: fireState.position },
  uFireFlicker: { value: 1 },
}

function createSnowMaterial(tex: Record<'diff' | 'nor' | 'rough', import('three').Texture>) {
  const m = new MeshStandardMaterial({
    map: tex.diff,
    normalMap: tex.nor,
    normalScale: new Vector2(0.8, 0.8),
    roughnessMap: tex.rough,
    roughness: 1,
    metalness: 0,
    color: '#dfe6f2',
  })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vWorld;\nvoid main() {')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        /* glsl */ `varying vec3 vWorld;
        uniform vec3 uMoonDir;
        uniform vec3 uFirePos;
        uniform float uFireFlicker;
        float hash12(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float glint(vec3 lightDir, vec3 viewDir, vec2 cell, float density) {
          float h = hash12(cell);
          if (h < density) return 0.0;
          // each ice crystal has its own random facet normal
          vec3 facet = normalize(vec3(hash12(cell + 1.7) - 0.5, 1.2, hash12(cell + 4.1) - 0.5));
          vec3 hv = normalize(lightDir + viewDir);
          return pow(max(dot(facet, hv), 0.0), 900.0);
        }
        void main() {`,
      )
      // Break up tiling with a second, rotated, larger-scale sample.
      .replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
        vec2 uv2 = mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.37 + 0.31;
        vec3 macro = texture2D(map, uv2).rgb;
        diffuseColor.rgb = mix(diffuseColor.rgb, macro, 0.45);
        diffuseColor.rgb *= 0.92 + 0.16 * sin(vWorld.x * 0.13) * sin(vWorld.z * 0.11);`,
      )
      .replace(
        '#include <lights_fragment_end>',
        /* glsl */ `#include <lights_fragment_end>
        {
          vec3 viewDirW = normalize(cameraPosition - vWorld);
          vec2 cell = floor(vWorld.xz * 70.0);
          float g = glint(uMoonDir, viewDirW, cell, 0.985) * 0.6;
          vec3 toFire = uFirePos - vWorld;
          float fd = length(toFire);
          float gf = glint(toFire / fd, viewDirW, cell + 19.0, 0.98) * uFireFlicker * 6.0 / (1.0 + fd * fd);
          float fade = 1.0 - smoothstep(6.0, 22.0, length(cameraPosition - vWorld));
          reflectedLight.directSpecular += (vec3(0.75, 0.82, 1.0) * g + vec3(1.0, 0.55, 0.25) * gf) * fade;
        }`,
      )
  }
  return m
}

export function Ground() {
  const tex = useTexture({ diff: ASSETS.snow.diff, nor: ASSETS.snow.nor, rough: ASSETS.snow.rough })

  const material = useMemo(() => {
    tex.diff.colorSpace = SRGBColorSpace
    const repeat = WORLD.groundSize / TILE
    for (const t of Object.values(tex)) {
      t.wrapS = t.wrapT = RepeatWrapping
      t.repeat.set(repeat, repeat)
      t.anisotropy = 16
    }
    return createSnowMaterial(tex)
  }, [tex])

  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(WORLD.groundSize, WORLD.groundSize, WORLD.groundSegments, WORLD.groundSegments)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)))
    geo.computeVertexNormals()
    return geo
  }, [])

  useFrame(() => {
    uniforms.uFireFlicker.value = fireState.flicker
  })

  return <mesh geometry={geometry} material={material} receiveShadow />
}
