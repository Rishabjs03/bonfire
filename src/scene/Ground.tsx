import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { MeshStandardMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace, Vector2, type Texture } from 'three'
import { WORLD } from '../config'
import { heightAt } from '../lib/terrain'
import { canopyTexture } from '../world/groundData'
import { world } from '../world/worldData'
import { ASSETS } from './assets'

const TILE = 2.4 // metres per texture repeat

function createMeadowMaterial(t: Record<'meadow' | 'meadowNor' | 'meadowRough' | 'needles' | 'needlesNor' | 'ortho', Texture>) {
  const { r0, rMax, local } = world().meta
  const m = new MeshStandardMaterial({
    map: t.meadow,
    normalMap: t.meadowNor,
    normalScale: new Vector2(0.9, 0.9),
    roughnessMap: t.meadowRough,
    roughness: 1,
    metalness: 0,
  })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNeedles = { value: t.needles }
    shader.uniforms.uCanopy = { value: canopyTexture }
    shader.uniforms.uOrtho = { value: t.ortho }
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vWorld;\nvoid main() {')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        /* glsl */ `varying vec3 vWorld;
        uniform sampler2D uNeedles;
        uniform sampler2D uCanopy;
        uniform sampler2D uOrtho;
        void main() {`,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
        // break up tiling with a rotated, larger-scale second sample
        vec2 uv2 = mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.31 + 0.27;
        diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(map, uv2).rgb, 0.4);
        // late summer: sun-bleached patches
        float patchy = 0.5 + 0.5 * sin(vWorld.x * 0.11 + sin(vWorld.z * 0.07) * 2.0) * sin(vWorld.z * 0.13);
        diffuseColor.rgb *= mix(vec3(0.92, 0.98, 0.86), vec3(1.08, 1.02, 0.86), patchy);
        // needle litter under the real trees
        float cover = texture2D(uCanopy, (vWorld.xz + ${local.half.toFixed(1)}) / ${(2 * local.half).toFixed(1)}).r;
        vec3 needles = texture2D(uNeedles, vMapUv * 0.8).rgb;
        diffuseColor.rgb = mix(diffuseColor.rgb, needles * 0.85, smoothstep(0.25, 0.75, cover));
        // far away, dissolve into the real aerial photo (which the distant terrain uses)
        float r = length(vWorld.xz);
        vec2 polar = vec2(fract(atan(vWorld.x, -vWorld.z) / 6.2831853), clamp(log(max(r, ${r0.toFixed(1)}) / ${r0.toFixed(1)}) / log(${(rMax / r0).toFixed(3)}), 0.0, 1.0));
        vec3 aerial = texture2D(uOrtho, polar).rgb;
        diffuseColor.rgb = mix(diffuseColor.rgb, aerial, smoothstep(70.0, 155.0, r) * 0.9);`,
      )
  }
  return m
}

/** The real meadow and forest floor around the fire (swissALTI3D heights at 2 m). */
export function Ground() {
  const tex = useTexture({
    meadow: ASSETS.ground.meadowDiff,
    meadowNor: ASSETS.ground.meadowNor,
    meadowRough: ASSETS.ground.meadowRough,
    needles: ASSETS.ground.needlesDiff,
    needlesNor: ASSETS.ground.needlesNor,
    ortho: '/assets/riffelalp/ortho.jpg',
  })

  const material = useMemo(() => {
    tex.meadow.colorSpace = SRGBColorSpace
    tex.needles.colorSpace = SRGBColorSpace
    tex.ortho.colorSpace = SRGBColorSpace
    const repeat = WORLD.groundSize / TILE
    for (const t of [tex.meadow, tex.meadowNor, tex.meadowRough, tex.needles, tex.needlesNor]) {
      t.wrapS = t.wrapT = RepeatWrapping
      t.repeat.set(repeat, repeat)
      t.anisotropy = 16
    }
    return createMeadowMaterial(tex)
  }, [tex])

  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(WORLD.groundSize, WORLD.groundSize, WORLD.groundSegments, WORLD.groundSegments)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)))
    geo.computeVertexNormals()
    return geo
  }, [])

  return <mesh geometry={geometry} material={material} receiveShadow />
}
