import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, useTexture } from '@react-three/drei'
import {
  AdditiveBlending,
  BufferGeometry,
  DirectionalLight,
  Euler,
  Float32BufferAttribute,
  Group,
  Object3D,
  ShaderMaterial,
  SRGBColorSpace,
} from 'three'
import { MOONLIGHT, SKY } from '../config'
import { createRng } from '../lib/random'
import { localRuntime } from '../store/gameStore'
import { ASSETS } from './assets'
import { MOON_DIR, SKY_ROTATION_Y } from './moon'
import { FAR_LAYER } from './Trees'

const SKY_RADIUS = 2400
const skyRotation = new Euler(0, SKY_ROTATION_Y, 0)

/** Crisp procedural stars on top of the (soft) HDRI sky. */
function createStars() {
  const rand = createRng(424242)
  const pos: number[] = []
  const col: number[] = []
  const size: number[] = []
  for (let i = 0; i < SKY.starCount; i++) {
    // uniform on the sphere, slightly below the horizon too (hidden by mountains)
    const y = rand() * 1.1 - 0.1
    const a = rand() * Math.PI * 2
    const r = Math.sqrt(1 - y * y)
    pos.push(Math.cos(a) * r * SKY_RADIUS, y * SKY_RADIUS, Math.sin(a) * r * SKY_RADIUS)
    // magnitude-like distribution: many faint, few bright
    const m = Math.pow(rand(), 7)
    const temp = rand()
    const c = temp < 0.15 ? [1, 0.82, 0.68] : temp > 0.8 ? [0.75, 0.85, 1] : [1, 0.97, 0.93]
    const b = 0.25 + m * 3.2
    col.push(c[0] * b, c[1] * b, c[2] * b)
    size.push(1.1 + m * 2.6)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new Float32BufferAttribute(col, 3))
  g.setAttribute('aSize', new Float32BufferAttribute(size, 1))
  return g
}

const starMaterial = new ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
  vertexShader: /* glsl */ `
    attribute vec3 color;
    attribute float aSize;
    uniform float uTime;
    uniform float uPixelRatio;
    varying vec3 vColor;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      float tw = 0.75 + 0.25 * sin(uTime * (1.5 + fract(position.x * 0.013) * 3.0) + position.z);
      // fade toward the horizon (extinction)
      float alt = normalize(position).y;
      vColor = color * tw * smoothstep(-0.02, 0.25, alt);
      gl_PointSize = aSize * uPixelRatio;
    }`,
  fragmentShader: /* glsl */ `
    varying vec3 vColor;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vColor * a * a, 1.0);
    }`,
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
})

function Moon() {
  const map = useTexture(ASSETS.moon)
  useEffect(() => {
    map.colorSpace = SRGBColorSpace
  }, [map])
  // Real angular diameter ≈ 0.52°
  const radius = Math.tan((0.26 * Math.PI) / 180) * SKY_RADIUS * SKY.moonSize
  return (
    <mesh position={MOON_DIR.clone().multiplyScalar(SKY_RADIUS)} renderOrder={-9} rotation={[0, -1.2, 0]}>
      <sphereGeometry args={[radius, 32, 16]} />
      <meshBasicMaterial map={map} color={[1.9, 1.85, 1.75]} fog={false} depthWrite={false} toneMapped />
    </mesh>
  )
}

/** Moonlight with a shadow frustum that follows the player. */
function Moonlight() {
  const light = useRef<DirectionalLight>(null!)
  const target = useMemo(() => new Object3D(), [])
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    scene.add(target)
    const l = light.current
    l.target = target
    const cam = l.shadow.camera
    const r = MOONLIGHT.shadowRange
    cam.left = -r
    cam.right = r
    cam.top = r
    cam.bottom = -r
    cam.near = 1
    cam.far = 260
    cam.layers.enable(FAR_LAYER) // distant trees (DISTANT_LAYER) are skipped
    cam.updateProjectionMatrix()
    return () => {
      scene.remove(target)
    }
  }, [scene, target])

  const frame = useRef(0)
  useFrame(() => {
    light.current.shadow.autoUpdate = false
    if (frame.current++ % 2 === 0) light.current.shadow.needsUpdate = true
    const p = localRuntime.position
    // snap to texel grid to avoid shimmering shadows while moving
    const step = (MOONLIGHT.shadowRange * 2) / MOONLIGHT.shadowMapSize
    const x = Math.round(p.x / step) * step
    const z = Math.round(p.z / step) * step
    target.position.set(x, p.y, z)
    light.current.position.set(x + MOON_DIR.x * 150, p.y + MOON_DIR.y * 150, z + MOON_DIR.z * 150)
  })

  return (
    <directionalLight
      ref={light}
      color={MOONLIGHT.color}
      intensity={MOONLIGHT.intensity}
      castShadow
      shadow-mapSize={[MOONLIGHT.shadowMapSize, MOONLIGHT.shadowMapSize]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.05}
    />
  )
}

export function Sky() {
  const group = useRef<Group>(null!)
  const stars = useMemo(() => createStars(), [])
  const dpr = useThree((s) => s.viewport.dpr)

  useFrame(({ camera, clock }) => {
    group.current.position.copy(camera.position)
    starMaterial.uniforms.uTime.value = clock.elapsedTime
    starMaterial.uniforms.uPixelRatio.value = dpr
  })

  return (
    <>
      <Environment
        files={SKY.hdr}
        background
        backgroundIntensity={SKY.backgroundIntensity}
        environmentIntensity={SKY.environmentIntensity}
        backgroundRotation={skyRotation}
        environmentRotation={skyRotation}
      />
      <group ref={group}>
        <points geometry={stars} material={starMaterial} renderOrder={-10} frustumCulled={false} />
        <Moon />
      </group>
      <Moonlight />
    </>
  )
}
