import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useGLTF, useTexture } from '@react-three/drei'
import {
  AnimationClip,
  AnimationMixer,
  BufferAttribute,
  Color,
  LoopOnce,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  type AnimationAction,
  type Bone,
  type BufferGeometry,
  type Texture,
} from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { damp } from '../lib/math'
import type { CharacterColors } from '../lib/palette'
import { ASSETS } from '../scene/assets'
import { useSocialStore } from '../store/socialStore'
import { labelLayerRef } from '../ui/labelLayer'
import type { MotionState } from './motion'
import { dressBody } from './garments'
import { HeldItems } from './HeldItems'
import { PlayerOverlays } from './Overlays'
import { CLIPS, LOOKS, PEOPLE_URLS, type Body, type LookId } from './people'

for (const b of ['male', 'female'] as Body[]) useGLTF.preload(PEOPLE_URLS.body(b))
useGLTF.preload(PEOPLE_URLS.anims)

// ------------------------------------------------------------------ clothing

/** Which garment each bone's skin belongs to: [jacket, trousers, boots, skin]. */
function boneRegion(name: string): [number, number, number, number] {
  if (/^(foot|ball)/.test(name)) return [0, 0, 1, 0]
  if (/^(pelvis|thigh|calf|root)/.test(name)) return [0, 1, 0, 0]
  if (/^neck/.test(name)) return [0.55, 0, 0, 0.45] // collar
  if (/^(spine|clavicle|upperarm|lowerarm)/.test(name)) return [1, 0, 0, 0]
  return [0, 0, 0, 1] // head, hands, fingers
}

/** Per-vertex garment weights from the skin weights (computed once per body geometry). */
function clothAttribute(geometry: BufferGeometry, bones: Bone[]) {
  if (geometry.getAttribute('aCloth')) return
  const idx = geometry.getAttribute('skinIndex')
  const wts = geometry.getAttribute('skinWeight')
  const out = new Float32Array(idx.count * 4)
  const regions = bones.map((b) => boneRegion(b.name))
  for (let v = 0; v < idx.count; v++) {
    for (let k = 0; k < 4; k++) {
      const w = wts.getComponent(v, k)
      if (w === 0) continue
      const r = regions[idx.getComponent(v, k)] ?? [0, 0, 0, 1]
      for (let c = 0; c < 4; c++) out[v * 4 + c] += r[c] * w
    }
  }
  geometry.setAttribute('aCloth', new BufferAttribute(out, 4))
}

interface ClothColors {
  jacket: string
  pants: string
  hair: string
}

/**
 * Dress the base body in shader: a quilted puffer jacket (inflated, with baffles),
 * trousers and leather boots, keeping skin on the face, neck and hands.
 */
function createClothedMaterial(src: MeshStandardMaterial, skin: Texture, fabricNor: Texture, c: ClothColors) {
  const m = src.clone()
  m.map = skin
  m.envMapIntensity = 0.6
  m.metalness = 0
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uJacket = { value: new Color(c.jacket) }
    shader.uniforms.uPants = { value: new Color(c.pants) }
    shader.uniforms.uBoots = { value: new Color('#3a2a1e') }
    shader.uniforms.uFabricNor = { value: fabricNor }
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'attribute vec4 aCloth;\nvarying vec4 vCloth;\nvarying float vBindY;\nvoid main() {\nvCloth = aCloth;\nvBindY = position.y;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        {
          // the mesh is already reshaped into clothes (garments.ts): add down-jacket baffles and boots
          float jacket = smoothstep(0.3, 0.7, aCloth.x);
          float baffles = 0.009 * abs(sin(position.y * 28.0));
          transformed += objectNormal * (jacket * baffles + aCloth.z * 0.02);
        }`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        /* glsl */ `uniform vec3 uJacket;
        uniform vec3 uPants;
        uniform vec3 uBoots;
        uniform sampler2D uFabricNor;
        varying vec4 vCloth;
        varying float vBindY;
        float clothAmount() {
          return clamp(smoothstep(0.35, 0.65, vCloth.x) + smoothstep(0.4, 0.6, vCloth.y) + smoothstep(0.4, 0.6, vCloth.z), 0.0, 1.0);
        }
        void main() {`,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
        {
          float j = smoothstep(0.35, 0.65, vCloth.x);
          float p = smoothstep(0.4, 0.6, vCloth.y);
          float b = smoothstep(0.4, 0.6, vCloth.z);
          vec3 jacket = uJacket * (0.9 + 0.1 * abs(sin(vBindY * 30.0)));
          vec3 cloth = (jacket * j + uPants * p + uBoots * b) / max(j + p + b, 1e-3);
          diffuseColor.rgb = mix(diffuseColor.rgb, cloth, clothAmount());
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, mix(0.8, 0.92, smoothstep(0.4, 0.6, vCloth.y)), clothAmount());`,
      )
      // Replace the skin's muscle detail with woven fabric where there are clothes.
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        #ifdef USE_NORMALMAP_TANGENTSPACE
        {
          vec3 fabricN = texture2D( uFabricNor, vNormalMapUv * 14.0 ).xyz * 2.0 - 1.0;
          fabricN.xy *= 0.5;
          vec3 fabricNormal = normalize( tbn * fabricN );
          normal = normalize( mix( normal, fabricNormal, clothAmount() ) );
        }
        #endif`,
      )
  }
  return m
}

// ------------------------------------------------------------------ assembly

interface Rig {
  root: Object3D
  mixer: AnimationMixer
  actions: Partial<Record<keyof typeof CLIPS, AnimationAction>>
  /** Bones that props attach to. */
  bones: { handR?: Bone }
}

const clipCache = new Map<Body, AnimationClip[]>()

/** The animation library's pelvis heights are for a shorter mannequin: scale them to this body. */
function clipsFor(body: Body, clips: AnimationClip[], pelvisRestHeight: number) {
  const hit = clipCache.get(body)
  if (hit) return hit
  const ratio = pelvisRestHeight / 0.917
  const out = clips.map((c) => {
    const clip = c.clone()
    for (const t of clip.tracks) if (t.name === 'pelvis.position') for (let i = 0; i < t.values.length; i++) t.values[i] *= ratio
    return clip
  })
  clipCache.set(body, out)
  return out
}

function buildRig(body: Body, bodyScene: Object3D, hairScenes: Object3D[], clips: AnimationClip[], skin: Texture, fabricNor: Texture, colors: ClothColors): Rig {
  const root = cloneSkinned(bodyScene)
  let armature: Object3D | null = null
  const bonesByName = new Map<string, Bone>()
  root.traverse((o) => {
    if ((o as Bone).isBone) bonesByName.set(o.name, o as Bone)
    const mesh = o as SkinnedMesh
    if (!mesh.isSkinnedMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    const mat = mesh.material as MeshStandardMaterial
    if (/Hair/.test(mat.name)) {
      // the hair textures are greyscale, meant to be tinted
      mesh.material = Object.assign(mat.clone(), { color: new Color(colors.hair) })
    }
    if (/Superhero/.test(mat.name)) {
      armature = mesh.parent
      clothAttribute(mesh.geometry, mesh.skeleton.bones)
      dressBody(mesh.geometry)
      mesh.material = createClothedMaterial(mat, skin, fabricNor, colors)
    }
  })

  // Hair is skinned to the same skeleton (head bone): re-bind it to this body's bones.
  const parent: Object3D = armature ?? root
  for (const scene of hairScenes) {
    scene.traverse((o) => {
      const hair = o as SkinnedMesh
      if (!hair.isSkinnedMesh) return
      const bones = hair.skeleton.bones.map((b) => bonesByName.get(b.name) ?? b)
      const mesh = new SkinnedMesh(hair.geometry, Object.assign((hair.material as MeshStandardMaterial).clone(), { color: new Color(colors.hair) }))
      mesh.bind(new Skeleton(bones, hair.skeleton.boneInverses), hair.bindMatrix)
      mesh.castShadow = true
      mesh.frustumCulled = false
      parent.add(mesh)
    })
  }

  const pelvis = bonesByName.get('pelvis')
  const mixer = new AnimationMixer(root)
  const scaled = clipsFor(body, clips, pelvis ? pelvis.position.z : 0.917)
  const byName = new Map(scaled.map((c) => [c.name, c]))
  const actions: Rig['actions'] = {}
  for (const [key, name] of Object.entries(CLIPS) as [keyof typeof CLIPS, string][]) {
    const clip = byName.get(name)
    if (!clip) continue
    const a = mixer.clipAction(clip)
    if (key === 'sitEnter' || key === 'sitExit' || key === 'wave') {
      a.setLoop(LoopOnce, 1)
      a.clampWhenFinished = true
    }
    a.setEffectiveWeight(key === 'idle' ? 1 : 0)
    actions[key] = a
  }
  return { root, mixer, actions, bones: { handR: bonesByName.get('hand_r') } }
}

// ------------------------------------------------------------------ component

interface CharacterProps {
  /** Player id, for speech bubbles and emotes. */
  playerId: string
  name: string
  look: LookId
  colors: CharacterColors
  motion: RefObject<MotionState>
  /** Extra overlays above the head. */
  children?: ReactNode
}

type Mode = 'stand' | 'enter' | 'seated' | 'exit'

/** A person by the fire: a real-proportioned body, clothes in their colours, captured motion. */
export function Character({ playerId, name, look, colors, motion, children }: CharacterProps) {
  const l = LOOKS[look]
  const bodyGltf = useGLTF(PEOPLE_URLS.body(l.body))
  const animGltf = useGLTF(PEOPLE_URLS.anims)
  const hairGltfs = useGLTF(l.hair.map(PEOPLE_URLS.hair))
  const tex = useTexture({ skin: PEOPLE_URLS.skin(l), fabric: ASSETS.fabric.cabanNor })

  const rig = useMemo(() => {
    tex.skin.colorSpace = SRGBColorSpace
    tex.skin.flipY = false // glTF UV convention
    tex.fabric.wrapS = tex.fabric.wrapT = RepeatWrapping
    return buildRig(
      l.body,
      bodyGltf.scene,
      hairGltfs.map((g) => g.scene),
      animGltf.animations,
      tex.skin,
      tex.fabric,
      { jacket: colors.body, pants: l.pants, hair: l.hairColor },
    )
  }, [l, bodyGltf.scene, hairGltfs, animGltf.animations, tex, colors.body])

  // Start every clip (weights decide what shows) whenever this rig mounts. Doing this in the
  // effect, not while building the rig, keeps React's dev double-mount from leaving the
  // loops stopped (which froze characters in a T-pose).
  useEffect(() => {
    for (const a of Object.values(rig.actions)) {
      a.reset()
      a.enabled = true
      a.play()
    }
    return () => {
      rig.mixer.stopAllAction()
    }
  }, [rig])

  // Free GPU materials only when the rig itself is replaced or the character leaves.
  useEffect(
    () => () => {
      rig.root.traverse((o) => {
        const m = o as Mesh
        if (m.isMesh && m.material && !Array.isArray(m.material)) (m.material as MeshStandardMaterial).dispose()
      })
    },
    [rig],
  )

  const state = useRef({ mode: 'stand' as Mode, t: 0, weights: {} as Record<string, number>, emoteSeen: 0 })

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const m = motion.current
    const s = state.current
    const { actions } = rig
    s.t += dt

    // sitting: sit down → seated → stand up
    if (m.sitting && (s.mode === 'stand' || s.mode === 'exit')) {
      s.mode = 'enter'
      s.t = 0
      actions.sitEnter?.reset().play()
    } else if (!m.sitting && (s.mode === 'seated' || s.mode === 'enter')) {
      s.mode = 'exit'
      s.t = 0
      actions.sitExit?.reset().play()
    }
    if (s.mode === 'enter' && s.t > (actions.sitEnter?.getClip().duration ?? 1) * 0.92) s.mode = 'seated'
    if (s.mode === 'exit' && s.t > (actions.sitExit?.getClip().duration ?? 1) * 0.85) s.mode = 'stand'

    const social = useSocialStore.getState()
    const talking = !!social.bubbles[playerId]
    const emote = social.emotes[playerId]
    if (emote && emote.nonce !== s.emoteSeen && s.mode === 'stand') {
      s.emoteSeen = emote.nonce
      if (emote.value === 'wave') actions.wave?.reset().play()
    }
    const waving = emote?.value === 'wave' && Date.now() - emote.at < 1900 && s.mode === 'stand'
    const dancing = emote?.value === 'dance' && Date.now() - emote.at < 4000 && s.mode === 'stand'

    // locomotion blend by ground speed: idle → walk → sprint
    const v = m.speed
    const moving = Math.min(1, Math.max(0, (v - 0.08) / 0.5))
    const sprint = Math.min(1, Math.max(0, (v - 2.3) / 1.2))
    const target: Record<string, number> = {}
    if (s.mode === 'stand') {
      const still = 1 - moving
      const gesture = waving || dancing ? 1 : 0
      target.idle = still * (talking ? 0 : 1) * (1 - gesture)
      target.talk = still * (talking ? 1 : 0) * (1 - gesture)
      target.wave = still * (waving ? 1 : 0)
      target.dance = still * (dancing ? 1 : 0)
      target.walk = moving * (1 - sprint)
      target.sprint = moving * sprint
    } else if (s.mode === 'enter') target.sitEnter = 1
    else if (s.mode === 'exit') target.sitExit = 1
    else {
      target.sitIdle = talking ? 0 : 1
      target.sitTalk = talking ? 1 : 0
    }
    if (actions.walk) actions.walk.timeScale = Math.min(1.7, Math.max(0.55, v / 1.3))
    if (actions.sprint) actions.sprint.timeScale = Math.min(1.35, Math.max(0.7, v / 4.6))

    const k = damp(s.mode === 'stand' ? 9 : 14, dt)
    for (const [key, action] of Object.entries(actions)) {
      const prev = s.weights[key] ?? (key === 'idle' ? 1 : 0)
      const w = prev + ((target[key] ?? 0) - prev) * k
      s.weights[key] = w
      action.setEffectiveWeight(w)
    }
    rig.mixer.update(dt)
  })

  return (
    <group>
      <primitive object={rig.root} />
      <HeldItems playerId={playerId} handR={rig.bones.handR} />
      <Html position={[0, 2.12, 0]} center distanceFactor={7} zIndexRange={[5, 0]} portal={labelLayerRef as RefObject<HTMLElement>}>
        <div className="flex flex-col items-center gap-1 select-none">
          <PlayerOverlays id={playerId} />
          {children}
          <span className="on-scene whitespace-nowrap text-[12px] font-medium tracking-[0.02em] text-ink/85">
            {name}
          </span>
        </div>
      </Html>
    </group>
  )
}
