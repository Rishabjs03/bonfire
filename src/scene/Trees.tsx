import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { TREES } from '../config'
import { FOREST } from '../lib/forest'
import { heightAt } from '../lib/terrain'
import { localRuntime } from '../store/gameStore'

const TRUNK = new Color('#3b2a20')
const NEEDLES = new Color('#1c3a2e')
const FROST = new Color('#c9d6e8')

/** Paint a geometry with a vertical gradient from `bottom` to `top` colors. */
function paint(geo: BufferGeometry, bottom: Color, top: Color, frost: number) {
  geo.computeBoundingBox()
  const { min, max } = geo.boundingBox!
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const c = new Color()
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - min.y) / (max.y - min.y || 1)
    c.copy(bottom).lerp(top, Math.pow(t, 2) * frost)
    c.toArray(colors, i * 3)
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geo
}

/** One low-poly pine: trunk + three stacked, frosted cones. Origin at the base. */
function createPineGeometry() {
  const trunk = paint(new CylinderGeometry(0.16, 0.22, 1.2, 6).translate(0, 0.6, 0), TRUNK, TRUNK, 0)
  const tiers = [
    { r: 1.25, h: 1.7, y: 1.6 },
    { r: 0.95, h: 1.5, y: 2.5 },
    { r: 0.62, h: 1.3, y: 3.35 },
  ].map(({ r, h, y }) => paint(new ConeGeometry(r, h, 7).translate(0, y, 0), NEEDLES, FROST, 0.55))
  const merged = mergeGeometries([trunk, ...tiers])!
  trunk.dispose()
  tiers.forEach((g) => g.dispose())
  return merged
}

/**
 * Trees near the camera, or between the camera and the player, dissolve with an
 * ordered dither so they never block the view. Cheap: no transparency sorting.
 */
function createTreeMaterial(playerView: { value: Vector3 }) {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPlayerView = playerView
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 uPlayerView;\nvoid main() {')
      .replace(
        '#include <clipping_planes_fragment>',
        /* glsl */ `#include <clipping_planes_fragment>
        float camDist = length(vViewPosition);
        float keep = smoothstep(${TREES.cameraFadeNear.toFixed(2)}, ${TREES.cameraFadeFar.toFixed(2)}, camDist);
        vec3 fragView = -vViewPosition;
        if (-fragView.z < -uPlayerView.z - 0.6) {
          vec2 a = fragView.xy / -fragView.z;
          vec2 b = uPlayerView.xy / -uPlayerView.z;
          float r = ${TREES.occlusionFade.toFixed(3)};
          keep = min(keep, mix(0.15, 1.0, smoothstep(r * 0.6, r, length(a - b))));
        }
        if (keep < 0.999) {
          ivec2 p = ivec2(mod(gl_FragCoord.xy, 4.0));
          float bayer[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
          if (keep < (bayer[p.x + p.y * 4] + 0.5) / 16.0) discard;
        }`,
      )
  }
  return material
}

export function Trees() {
  const ref = useRef<InstancedMesh>(null!)
  const geometry = useMemo(() => createPineGeometry(), [])
  const playerView = useMemo(() => ({ value: new Vector3() }), [])
  const material = useMemo(() => createTreeMaterial(playerView), [playerView])

  useLayoutEffect(() => {
    const dummy = new Object3D()
    const tint = new Color()
    FOREST.forEach((t, i) => {
      dummy.position.set(t.x, heightAt(t.x, t.z) - 0.1, t.z)
      dummy.rotation.set(0, t.rotation, 0)
      dummy.scale.set(t.scale, t.scale * t.heightScale, t.scale)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
      ref.current.setColorAt(i, tint.setScalar(t.shade))
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [])

  useFrame(({ camera }) => {
    const p = localRuntime.position
    playerView.value.set(p.x, p.y + 0.8, p.z).applyMatrix4(camera.matrixWorldInverse)
  })

  return <instancedMesh ref={ref} args={[geometry, material, FOREST.length]} frustumCulled={false} />
}
