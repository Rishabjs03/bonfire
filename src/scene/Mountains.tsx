import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group } from 'three'
import { MOUNTAINS, WORLD } from '../config'
import { createRng } from '../lib/random'

interface RidgeOptions {
  radius: number
  minHeight: number
  maxHeight: number
  base: string
  snow: string
  seed: number
}

/**
 * A jagged ring of peaks around the world, built as a strip of triangles.
 * Each peak has a mid-slope vertex so the faces read as low-poly facets.
 */
function createRidge({ radius, minHeight, maxHeight, base, snow, seed }: RidgeOptions) {
  const rand = createRng(seed)
  const peaks = MOUNTAINS.count * 4
  const baseColor = new Color(base)
  const snowColor = new Color(snow)
  const positions: number[] = []
  const colors: number[] = []

  const heights: number[] = []
  for (let i = 0; i < peaks; i++) {
    // alternate peaks and saddles, with large-scale variation
    const big = 0.5 + 0.5 * Math.sin((i / peaks) * Math.PI * 2 * 3 + seed)
    const peak = i % 2 === 0 ? 1 : 0.45 + rand() * 0.3
    heights.push(minHeight + (maxHeight - minHeight) * peak * (0.55 + 0.45 * big) * (0.75 + rand() * 0.25))
  }

  const point = (i: number, h: number, r = radius): [number, number, number] => {
    const a = (i / peaks) * Math.PI * 2
    return [Math.sin(a) * r, h, Math.cos(a) * r]
  }
  const push = (p: [number, number, number], c: Color) => {
    positions.push(...p)
    colors.push(c.r, c.g, c.b)
  }
  const snowLine = minHeight + (maxHeight - minHeight) * 0.55
  const colorFor = (h: number) => (h > snowLine ? snowColor : baseColor)

  for (let i = 0; i < peaks; i++) {
    const j = (i + 1) % peaks
    const h0 = heights[i]
    const h1 = heights[j]
    const bottom0 = point(i, -10)
    const bottom1 = point(j, -10)
    const top0 = point(i, h0)
    const top1 = point(j, h1)
    // two triangles per segment; top vertices take the snow tint
    push(bottom0, baseColor)
    push(top0, colorFor(h0))
    push(bottom1, baseColor)
    push(bottom1, baseColor)
    push(top0, colorFor(h0))
    push(top1, colorFor(h1))
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geo
}

/** Alps silhouette on the horizon. Follows the camera like a skybox so it never gets closer. */
export function Mountains() {
  const group = useRef<Group>(null!)
  const far = useMemo(
    () =>
      createRidge({
        radius: MOUNTAINS.distance + 35,
        minHeight: 10,
        maxHeight: 36,
        base: '#0a0f1c',
        snow: '#27324b',
        seed: WORLD.seed + 1,
      }),
    [],
  )
  const near = useMemo(
    () =>
      createRidge({
        radius: MOUNTAINS.distance,
        minHeight: 4,
        maxHeight: 20,
        base: '#070b15',
        snow: '#161e30',
        seed: WORLD.seed + 2,
      }),
    [],
  )

  useFrame(({ camera }) => {
    group.current.position.set(camera.position.x, 0, camera.position.z)
  })

  return (
    <group ref={group}>
      <mesh geometry={far} renderOrder={-2}>
        <meshBasicMaterial vertexColors fog={false} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh geometry={near} renderOrder={-1}>
        <meshBasicMaterial vertexColors fog={false} side={DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}
