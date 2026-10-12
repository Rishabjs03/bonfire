import { useMemo } from 'react'
import { PlaneGeometry } from 'three'
import { COLORS, WORLD } from '../config'
import { heightAt } from '../lib/terrain'

export function Ground() {
  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(WORLD.groundSize, WORLD.groundSize, WORLD.groundSegments, WORLD.groundSegments)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)))
    }
    geo.computeVertexNormals()
    return geo
  }, [])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={COLORS.ground} roughness={0.95} metalness={0} flatShading />
    </mesh>
  )
}
