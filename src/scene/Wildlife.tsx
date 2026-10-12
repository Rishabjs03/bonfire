import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import {
  Box3,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { audioEngine } from '../audio/audioEngine'
import { TREES, WILDLIFE } from '../config'
import { FOREST } from '../lib/forest'
import { lerpAngle } from '../lib/math'
import { createRng } from '../lib/random'
import { ROCKS } from '../lib/rocks'
import { heightAt } from '../lib/terrain'
import { remotes } from '../net/remotes'
import { localRuntime } from '../store/gameStore'
import { VIEW_DIR } from '../world/directions'
import { ASSETS } from './assets'

/**
 * Wildlife at dusk: a few cows grazing in the far meadow (the cowbells you can already
 * hear) and a marmot keeping watch from a boulder, which whistles and bolts for its burrow
 * when someone runs at it. Everything is built in code; placement is seeded so everyone
 * sees the animals in the same places (their wandering is local and not synced).
 */

const viewAngle = Math.atan2(VIEW_DIR.x, VIEW_DIR.z)

/** Inside the kept-clear sightline from the fire to the Matterhorn (plus a margin). */
function inViewCorridor(x: number, z: number) {
  let d = Math.abs(Math.atan2(x, z) - viewAngle) % (Math.PI * 2)
  if (d > Math.PI) d = Math.PI * 2 - d
  return d < ((TREES.viewCorridor + 6) * Math.PI) / 180
}

const nearTree = (x: number, z: number, r: number) => FOREST.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < r * r)

// ------------------------------------------------------------------ geometry helpers

/** Tag a geometry with a flat vertex colour so parts can be merged into one draw call. */
function colored(geo: BufferGeometry, hex: string) {
  const c = new Color(hex)
  const n = geo.getAttribute('position').count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new Float32BufferAttribute(arr, 3))
  return geo
}

/** A cow's hide: Simmental (red-brown with white patches) or Brown Swiss (plain grey-brown). */
function hideTexture(rand: () => number, simmental: boolean) {
  const w = 128
  const h = 64
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = simmental ? '#a2532b' : '#8a7764'
  ctx.fillRect(0, 0, w, h)
  if (simmental) {
    ctx.fillStyle = '#efe6d6'
    const patches = 5 + Math.floor(rand() * 5)
    for (let i = 0; i < patches; i++) {
      ctx.beginPath()
      ctx.ellipse(rand() * w, rand() * h, 8 + rand() * 22, 6 + rand() * 14, rand() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
    // white underside
    ctx.fillRect(0, h * 0.82, w, h * 0.18)
  } else {
    // darker along the back, paler belly
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, 'rgba(60,45,35,0.45)')
    g.addColorStop(0.5, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(230,220,200,0.5)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

// ------------------------------------------------------------------ cows

interface Cow {
  root: Group
  head: Group
  tail: Mesh
  x: number
  z: number
  heading: number
  home: { x: number; z: number }
  trees: { x: number; z: number }[]
  walking: boolean
  timer: number
  headPitch: number
  legPhase: number
  tailT: number
  tailFlick: number
}

const LEG_HIP_Y = 0.78
const LEG_OFFSETS: [number, number][] = [
  [0.2, 0.55],
  [-0.2, 0.55],
  [0.2, -0.55],
  [-0.2, -0.55],
]

function buildCow(rand: () => number, index: number, home: { x: number; z: number }): Cow {
  const simmental = rand() < 0.7
  const hide = new MeshStandardMaterial({ map: hideTexture(rand, simmental), roughness: 0.95 })
  const parts = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })

  const root = new Group()
  // body: a capsule lying along z, a touch taller than wide
  const bodyGeo = new CapsuleGeometry(0.38, 0.95, 4, 12)
  bodyGeo.rotateX(Math.PI / 2)
  bodyGeo.scale(1, 1.08, 1)
  const body = new Mesh(bodyGeo, hide)
  body.position.y = 0.98
  root.add(body)

  // head group pivots at the front of the body: pitches down to graze
  const head = new Group()
  head.position.set(0, 1.12, 0.8)
  root.add(head)
  const neckGeo = new CapsuleGeometry(0.17, 0.28, 3, 10)
  neckGeo.rotateX(-Math.PI / 2 + 0.75)
  neckGeo.translate(0, 0.12, 0.2)
  const skull = new Mesh(new SphereGeometry(0.2, 12, 10), hide)
  skull.scale.set(0.85, 1, 1.35)
  skull.position.set(0, 0.28, 0.48)
  head.add(skull)
  const muzzle = colored(new SphereGeometry(0.13, 10, 8), '#e9d9c4')
  muzzle.scale(1, 0.85, 1)
  muzzle.translate(0, 0.2, 0.72)
  const earL = colored(new SphereGeometry(0.07, 8, 6), simmental ? '#a2532b' : '#7d6b5a')
  earL.scale(1.6, 0.6, 0.9)
  earL.translate(0.22, 0.4, 0.4)
  const earR = earL.clone()
  earR.translate(-0.44, 0, 0)
  const hornL = colored(new ConeGeometry(0.035, 0.18, 7), '#d8cdb8')
  hornL.rotateZ(-0.7)
  hornL.translate(0.14, 0.52, 0.38)
  const hornR = colored(new ConeGeometry(0.035, 0.18, 7), '#d8cdb8')
  hornR.rotateZ(0.7)
  hornR.translate(-0.14, 0.52, 0.38)
  const bell = colored(new CylinderGeometry(0.05, 0.065, 0.09, 8), '#b9933f')
  bell.translate(0, -0.26, 0.26)
  const strap = colored(new CylinderGeometry(0.2, 0.2, 0.05, 12, 1, true), '#3a2a1e')
  strap.rotateX(-Math.PI / 2 + 0.75)
  strap.translate(0, -0.03, 0.16)
  head.add(new Mesh(mergeGeometries([colored(neckGeo, simmental ? '#a2532b' : '#8a7764'), muzzle, earL, earR, hornL, hornR, bell, strap]), parts))

  const tailGeo = new CylinderGeometry(0.02, 0.035, 0.62, 6)
  tailGeo.translate(0, -0.31, 0)
  const tuft = new SphereGeometry(0.06, 6, 5)
  tuft.translate(0, -0.64, 0)
  const tail = new Mesh(mergeGeometries([colored(tailGeo, simmental ? '#8e4a28' : '#6e5e4e'), colored(tuft, '#2a211a')]), parts)
  tail.position.set(0, 1.18, -0.86)
  root.add(tail)

  root.position.set(home.x, heightAt(home.x, home.z), home.z)
  const heading = rand() * Math.PI * 2
  root.rotation.y = heading
  return {
    root,
    head,
    tail,
    x: home.x,
    z: home.z,
    heading,
    home,
    trees: FOREST.filter((t) => (t.x - home.x) ** 2 + (t.z - home.z) ** 2 < 18 * 18).map((t) => ({ x: t.x, z: t.z })),
    walking: false,
    timer: 2 + index * 1.7 + rand() * 6,
    headPitch: 1.15,
    legPhase: rand() * Math.PI * 2,
    tailT: rand() * 10,
    tailFlick: 0,
  }
}

/** Grazing spots in the far meadow: outside the clearing and the Matterhorn sightline, clear of trees. */
function placeCows(rand: () => number) {
  const spots: { x: number; z: number }[] = []
  let attempts = 0
  while (spots.length < WILDLIFE.cows && attempts++ < 4000) {
    const a = rand() * Math.PI * 2
    const r = WILDLIFE.cowMinRadius + rand() * (WILDLIFE.cowMaxRadius - WILDLIFE.cowMinRadius)
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    if (inViewCorridor(x, z)) continue
    if (nearTree(x, z, 4)) continue
    if (spots.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 6 * 6)) continue
    spots.push({ x, z })
  }
  return spots
}

// ------------------------------------------------------------------ marmot

type MarmotPhase = 'sit' | 'nibble' | 'bolt' | 'hidden' | 'return'

interface Marmot {
  root: Group
  pose: Group
  head: Group
  rock: { x: number; z: number; top: number }
  burrow: { x: number; z: number }
  phase: MarmotPhase
  timer: number
  x: number
  z: number
  y: number
  heading: number
  /** 0 = sitting upright, 1 = on all fours */
  crouch: number
  crouchTarget: number
  headYaw: number
  headYawTarget: number
  lookTimer: number
  runT: number
}

function buildMarmot(rock: { x: number; z: number; top: number }, burrow: { x: number; z: number }): Marmot {
  const fur = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })
  const root = new Group()
  const pose = new Group()
  root.add(pose)

  const body = new CapsuleGeometry(0.11, 0.15, 4, 10)
  body.translate(0, 0.19, 0)
  const belly = new SphereGeometry(0.085, 8, 6)
  belly.scale(1, 1.4, 0.8)
  belly.translate(0, 0.17, 0.055)
  const tail = new CapsuleGeometry(0.03, 0.12, 3, 6)
  tail.rotateX(-0.9)
  tail.translate(0, 0.07, -0.14)
  const pawL = new SphereGeometry(0.03, 6, 5)
  pawL.translate(0.05, 0.22, 0.1)
  const pawR = pawL.clone()
  pawR.translate(-0.1, 0, 0)
  pose.add(new Mesh(mergeGeometries([colored(body, '#8a6a3c'), colored(belly, '#c9a870'), colored(tail, '#5e4426'), colored(pawL, '#4a3620'), colored(pawR, '#4a3620')]), fur))

  const head = new Group()
  head.position.set(0, 0.34, 0.03)
  pose.add(head)
  const skull = new SphereGeometry(0.085, 10, 8)
  skull.scale(1, 0.9, 1.1)
  const muzzle = new SphereGeometry(0.045, 8, 6)
  muzzle.translate(0, -0.02, 0.08)
  const nose = new SphereGeometry(0.014, 6, 5)
  nose.translate(0, -0.012, 0.125)
  const earL = new SphereGeometry(0.024, 6, 5)
  earL.translate(0.06, 0.06, -0.01)
  const earR = earL.clone()
  earR.translate(-0.12, 0, 0)
  const eyeL = new SphereGeometry(0.012, 6, 5)
  eyeL.translate(0.045, 0.02, 0.065)
  const eyeR = eyeL.clone()
  eyeR.translate(-0.09, 0, 0)
  head.add(new Mesh(mergeGeometries([colored(skull, '#7d5f36'), colored(muzzle, '#c9a870'), colored(nose, '#1c1410'), colored(earL, '#5e4426'), colored(earR, '#5e4426'), colored(eyeL, '#120d08'), colored(eyeR, '#120d08')]), fur))

  root.position.set(rock.x, rock.top, rock.z)
  const heading = Math.atan2(-rock.x, -rock.z) // facing the fire
  root.rotation.y = heading
  return {
    root,
    pose,
    head,
    rock,
    burrow,
    phase: 'sit',
    timer: 6,
    x: rock.x,
    z: rock.z,
    y: rock.top,
    heading,
    crouch: 0,
    crouchTarget: 0,
    headYaw: 0,
    headYawTarget: 0,
    lookTimer: 1,
    runT: 0,
  }
}

const tmp = new Vector3()
const legMatrix = new Matrix4()
const legQuat = new Quaternion()
const legPos = new Vector3()
const legScale = new Vector3(1, 1, 1)
const legAxis = new Vector3(1, 0, 0)
const bodyQuat = new Quaternion()
const yAxis = new Vector3(0, 1, 0)

/** The nearest person to (x, z) and how fast they're going. */
function nearestPerson(x: number, z: number, out: { d: number; speed: number }) {
  const p = localRuntime.position
  out.d = Math.hypot(p.x - x, p.z - z)
  out.speed = localRuntime.speed
  for (const r of remotes.values()) {
    const s = r.buffer.latest
    if (!s) continue
    const d = Math.hypot(s.x - x, s.z - z)
    if (d < out.d) {
      out.d = d
      out.speed = r.moving ? Math.hypot(s.vx, s.vz) : 0
    }
  }
}
const near = { d: 0, speed: 0 }

export function Wildlife() {
  const rockA = useGLTF(ASSETS.rocks[0])
  const rockB = useGLTF(ASSETS.rocks[1])

  const { root, cows, legs, marmots } = useMemo(() => {
    const rand = createRng(5150)
    const root = new Group()

    const cows = placeCows(rand).map((home, i) => buildCow(rand, i, home))
    for (const c of cows) root.add(c.root)
    // all the legs in one instanced draw, pivoting at the hip
    const legGeo = new CylinderGeometry(0.07, 0.08, LEG_HIP_Y, 7)
    legGeo.translate(0, -LEG_HIP_Y / 2, 0)
    const hoof = new CylinderGeometry(0.085, 0.085, 0.09, 7)
    hoof.translate(0, -LEG_HIP_Y + 0.045, 0)
    const legs = new InstancedMesh(mergeGeometries([colored(legGeo, '#7a5a40'), colored(hoof, '#2a211a')]), new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), cows.length * 4)
    legs.frustumCulled = false
    root.add(legs)

    // marmots keep watch from the biggest boulders in the middle distance
    const boxes = [rockA.scene, rockB.scene].map((s) => new Box3().setFromObject(s))
    const inRange = ROCKS.filter((r) => {
      const d = Math.hypot(r.x, r.z)
      return d > WILDLIFE.marmotRockMin && d < WILDLIFE.marmotRockMax
    }).sort((a, b) => b.scale - a.scale)
    const big = inRange.filter((r) => r.scale > 1)
    const candidates = big.length > 0 ? big : inRange
    const marmots: Marmot[] = []
    for (const r of candidates.slice(0, WILDLIFE.marmots)) {
      const box = boxes[r.model]
      const h = box.max.y - box.min.y
      // Rocks.tsx sinks each boulder by 30% of its height; stand a little below the very top
      const top = heightAt(r.x, r.z) + h * 0.62 * r.scale
      const away = Math.atan2(r.x, r.z) + (rand() - 0.5) * 1.2
      const dist = WILDLIFE.burrowMin + rand() * (WILDLIFE.burrowMax - WILDLIFE.burrowMin)
      const burrow = { x: r.x + Math.sin(away) * dist, z: r.z + Math.cos(away) * dist }
      const m = buildMarmot({ x: r.x, z: r.z, top }, burrow)
      marmots.push(m)
      root.add(m.root)
    }
    return { root, cows, legs, marmots }
  }, [rockA.scene, rockB.scene])

  const clock = useRef(0)

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    clock.current += dt
    const t = clock.current

    // --- cows ------------------------------------------------------------------------
    let leg = 0
    for (const c of cows) {
      c.timer -= dt
      if (c.timer <= 0) {
        c.walking = !c.walking
        c.timer = c.walking
          ? WILDLIFE.walkMin + Math.random() * (WILDLIFE.walkMax - WILDLIFE.walkMin)
          : WILDLIFE.grazeMin + Math.random() * (WILDLIFE.grazeMax - WILDLIFE.grazeMin)
      }
      if (c.walking) {
        // amble with a gentle wobble; turn back toward home or away from a tree ahead
        let target = c.heading + Math.sin(t * 0.37 + c.legPhase) * 0.35
        const fromHome = Math.hypot(c.x - c.home.x, c.z - c.home.z)
        if (fromHome > WILDLIFE.cowRoam) target = Math.atan2(c.home.x - c.x, c.home.z - c.z)
        const aheadX = c.x + Math.sin(c.heading) * 2.5
        const aheadZ = c.z + Math.cos(c.heading) * 2.5
        for (const tree of c.trees) {
          if ((tree.x - aheadX) ** 2 + (tree.z - aheadZ) ** 2 < 2.2 * 2.2) {
            target = c.heading + 1.4
            break
          }
        }
        c.heading = lerpAngle(c.heading, target, Math.min(1, 0.9 * dt))
        c.x += Math.sin(c.heading) * WILDLIFE.cowWalkSpeed * dt
        c.z += Math.cos(c.heading) * WILDLIFE.cowWalkSpeed * dt
        c.legPhase += dt * 2.6
        c.root.position.set(c.x, heightAt(c.x, c.z), c.z)
        c.root.rotation.y = c.heading
      }
      // head: down in the grass while grazing (with small tugs), up and swaying while walking
      const pitchTarget = c.walking ? 0.1 : 1.15 + Math.sin(t * 1.7 + c.legPhase) * 0.08
      c.headPitch += (pitchTarget - c.headPitch) * Math.min(1, 1.6 * dt)
      c.head.rotation.x = c.headPitch
      c.head.rotation.y = c.walking ? Math.sin(t * 0.9 + c.legPhase) * 0.12 : Math.sin(t * 0.23 + c.legPhase) * 0.25
      // tail: hangs, flicks at flies now and then
      c.tailT -= dt
      if (c.tailT <= 0) {
        c.tailT = 3 + Math.random() * 9
        c.tailFlick = 1
      }
      c.tailFlick = Math.max(0, c.tailFlick - dt * 1.8)
      c.tail.rotation.z = Math.sin(c.tailFlick * Math.PI * 3) * 0.9 * c.tailFlick
      c.tail.rotation.x = -0.15

      // legs: diagonal pairs swing while walking
      bodyQuat.setFromAxisAngle(yAxis, c.heading)
      const swing = c.walking ? 0.32 : 0
      for (let k = 0; k < 4; k++) {
        const [ox, oz] = LEG_OFFSETS[k]
        const phase = c.legPhase + (k === 0 || k === 3 ? 0 : Math.PI)
        legQuat.setFromAxisAngle(legAxis, Math.sin(phase) * swing)
        legQuat.premultiply(bodyQuat)
        legPos.set(ox, LEG_HIP_Y, oz).applyQuaternion(bodyQuat).add(c.root.position)
        legMatrix.compose(legPos, legQuat, legScale)
        legs.setMatrixAt(leg++, legMatrix)
      }
    }
    legs.instanceMatrix.needsUpdate = true

    // --- marmots --------------------------------------------------------------------
    for (const m of marmots) {
      m.timer -= dt
      if (m.phase === 'sit' || m.phase === 'nibble') {
        nearestPerson(m.x, m.z, near)
        const scared = near.d < WILDLIFE.marmotAlarmAny || (near.d < WILDLIFE.marmotAlarmSprint && near.speed > WILDLIFE.marmotAlarmSpeed)
        if (scared) {
          // where is it relative to the camera? (for the whistle's stereo position)
          const cam = localRuntime.cameraYaw
          tmp.set(m.x - localRuntime.position.x, 0, m.z - localRuntime.position.z)
          const d = tmp.length() || 1
          const pan = (tmp.x * -Math.cos(cam) + tmp.z * Math.sin(cam)) / d
          audioEngine.marmotWhistle(pan, d)
          m.phase = 'bolt'
          m.crouchTarget = 1
          m.heading = Math.atan2(m.burrow.x - m.x, m.burrow.z - m.z)
          m.runT = 0
        } else if (m.timer <= 0) {
          if (m.phase === 'sit') {
            m.phase = 'nibble'
            m.crouchTarget = 1
            m.timer = 4 + Math.random() * 4
          } else {
            m.phase = 'sit'
            m.crouchTarget = 0
            m.timer = 6 + Math.random() * 8
          }
        }
        // glance around while sitting up
        m.lookTimer -= dt
        if (m.lookTimer <= 0) {
          m.lookTimer = 1.5 + Math.random() * 3
          m.headYawTarget = m.phase === 'sit' ? (Math.random() - 0.5) * 1.6 : 0
        }
      } else if (m.phase === 'bolt') {
        const dx = m.burrow.x - m.x
        const dz = m.burrow.z - m.z
        const dist = Math.hypot(dx, dz)
        const step = WILDLIFE.marmotBoltSpeed * dt
        if (dist <= step) {
          m.phase = 'hidden'
          m.root.visible = false
          m.timer = WILDLIFE.marmotReturnMin + Math.random() * (WILDLIFE.marmotReturnMax - WILDLIFE.marmotReturnMin)
        } else {
          m.x += (dx / dist) * step
          m.z += (dz / dist) * step
          m.runT += dt
          // first half-second: hop down off the rock
          const ground = heightAt(m.x, m.z)
          m.y = m.runT < 0.5 ? m.rock.top + (ground - m.rock.top) * (m.runT / 0.5) : ground
        }
      } else if (m.phase === 'hidden') {
        if (m.timer <= 0) {
          m.phase = 'return'
          m.root.visible = true
          m.x = m.burrow.x
          m.z = m.burrow.z
          m.heading = Math.atan2(m.rock.x - m.x, m.rock.z - m.z)
          m.crouchTarget = 1
          m.runT = 0
        }
      } else {
        // return: trot back and climb the rock
        const dx = m.rock.x - m.x
        const dz = m.rock.z - m.z
        const dist = Math.hypot(dx, dz)
        const step = WILDLIFE.marmotBoltSpeed * 0.45 * dt
        if (dist <= step) {
          m.x = m.rock.x
          m.z = m.rock.z
          m.y = m.rock.top
          m.phase = 'sit'
          m.crouchTarget = 0
          m.heading = Math.atan2(-m.rock.x, -m.rock.z)
          m.timer = 8 + Math.random() * 8
        } else {
          m.x += (dx / dist) * step
          m.z += (dz / dist) * step
          const ground = heightAt(m.x, m.z)
          m.y = dist < 1.2 ? ground + (m.rock.top - ground) * (1 - dist / 1.2) : ground
        }
      }

      m.crouch += (m.crouchTarget - m.crouch) * Math.min(1, 6 * dt)
      m.headYaw += (m.headYawTarget - m.headYaw) * Math.min(1, 5 * dt)
      const running = m.phase === 'bolt' || m.phase === 'return'
      const bob = running ? Math.abs(Math.sin(t * 14)) * 0.05 : m.phase === 'nibble' ? Math.sin(t * 5) * 0.012 : 0
      m.root.position.set(m.x, m.y + bob, m.z)
      m.root.rotation.y = m.heading
      m.pose.rotation.x = m.crouch * 1.25
      m.pose.position.y = -m.crouch * 0.1
      m.head.rotation.y = m.headYaw
      m.head.rotation.x = -m.crouch * 0.9 + (m.phase === 'nibble' ? Math.sin(t * 5) * 0.15 : 0)
    }
  })

  return <primitive object={root} />
}
