import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import { AdditiveBlending, Group, Vector3 } from 'three'
import { COLORS, LIGHTING } from '../config'
import { getSoftDotTexture } from '../lib/textures'

const MOON_DIR = new Vector3(...LIGHTING.moonPosition).normalize()
const MOON_DISTANCE = 170

/** Stars, a faint moon, and the cool moonlight. The sky follows the camera like a skybox. */
export function Sky() {
  const group = useRef<Group>(null!)

  useFrame(({ camera }) => {
    group.current.position.copy(camera.position)
  })

  return (
    <>
      <group ref={group}>
        <Stars radius={180} depth={40} count={2200} factor={5} saturation={0} fade speed={0.25} />
        <group position={MOON_DIR.clone().multiplyScalar(MOON_DISTANCE)}>
          <mesh>
            <sphereGeometry args={[4, 24, 16]} />
            <meshBasicMaterial color="#dfe6ff" fog={false} />
          </mesh>
          <sprite scale={[34, 34, 1]}>
            <spriteMaterial
              map={getSoftDotTexture()}
              color="#6f82c8"
              opacity={0.22}
              transparent
              depthWrite={false}
              blending={AdditiveBlending}
              fog={false}
            />
          </sprite>
        </group>
      </group>

      <ambientLight color={COLORS.ambient} intensity={LIGHTING.ambientIntensity} />
      <hemisphereLight args={[LIGHTING.hemiSky, LIGHTING.hemiGround, LIGHTING.hemiIntensity]} />
      <directionalLight color={COLORS.moon} intensity={LIGHTING.moonIntensity} position={LIGHTING.moonPosition} />
    </>
  )
}
