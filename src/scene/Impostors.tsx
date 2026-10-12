import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import {
  BufferAttribute,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from 'three'
import { createTree } from '../lib/firTree'
import type { TreeInstance } from '../lib/forest'
import { createRng } from '../lib/random'
import { heightAt } from '../lib/terrain'
import { world } from '../world/worldData'
import { ASSETS } from './assets'
import { TERRAIN_GLSL, terrainUniforms } from './terrainShading'

const IMPOSTOR_H = { larch: 18, pine: 12 }
const ASPECT = 0.5 // each atlas cell is 512 × 1024
const CELLS = 4 // two larches and two stone pines, for variety

/** Render a larch and a stone pine once, side-on, into a 1024² atlas (albedo × baked AO). */
function bakeAtlas(gl: WebGLRenderer, tex: Record<string, Texture>) {
  const rt = new WebGLRenderTarget(512 * CELLS, 1024, { generateMipmaps: true, minFilter: LinearMipmapLinearFilter })
  rt.texture.colorSpace = SRGBColorSpace
  const scene = new Scene()
  const cam = new OrthographicCamera(-1, 1, 1, -1, -50, 50)
  const kinds = [
    { species: 'larch' as const, map: tex.fir, alpha: tex.firAlpha, bark: '#a07d68' },
    { species: 'larch' as const, map: tex.fir, alpha: tex.firAlpha, bark: '#a07d68' },
    { species: 'pine' as const, map: tex.pine, alpha: tex.pineAlpha, bark: '#8b8682' },
    { species: 'pine' as const, map: tex.pine, alpha: tex.pineAlpha, bark: '#8b8682' },
  ]
  const prevTarget = gl.getRenderTarget()
  const prevViewport = gl.getViewport(new Vector4())
  const prevClear = gl.getClearColor(new Color())
  const prevAlpha = gl.getClearAlpha()
  gl.setRenderTarget(rt)
  gl.setClearColor('#1f2a1c', 0) // forest-coloured transparent edges: no dark halos when filtered
  gl.clear()
  kinds.forEach((k, i) => {
    const h = IMPOSTOR_H[k.species]
    const geo = createTree(k.species, h * (i % 2 ? 0.92 : 1), 555 + i * 17, i % 2 === 1)
    const foliage = new Mesh(
      geo.foliage,
      new MeshBasicMaterial({ map: k.map, alphaMap: k.alpha, alphaTest: 0.4, vertexColors: true, side: DoubleSide }),
    )
    const bark = new Mesh(geo.bark, new MeshBasicMaterial({ map: tex.bark, color: k.bark }))
    scene.clear()
    scene.add(foliage, bark)
    const half = (h * 1.04) / 2
    cam.left = -half * ASPECT
    cam.right = half * ASPECT
    cam.top = h * 1.02
    cam.bottom = -h * 0.02
    cam.position.set(0, 0, 10)
    cam.lookAt(0, 0, 0)
    cam.updateProjectionMatrix()
    gl.setViewport(i * 512, 0, 512, 1024)
    gl.render(scene, cam)
    geo.foliage.dispose()
    geo.bark.dispose()
  })
  gl.setRenderTarget(prevTarget)
  gl.setViewport(prevViewport)
  gl.setClearColor(prevClear, prevAlpha)
  return rt
}

let atlas: WebGLRenderTarget | null = null

/** Bake on first use, then share. */
function atlasFor(gl: WebGLRenderer, tex: Record<string, Texture>) {
  if (!atlas) {
    tex.fir.colorSpace = SRGBColorSpace
    tex.pine.colorSpace = SRGBColorSpace
    tex.bark.colorSpace = SRGBColorSpace
    tex.bark.wrapS = tex.bark.wrapT = RepeatWrapping
    atlas = bakeAtlas(gl, tex)
  }
  return atlas.texture
}

/** The impostor atlas is baked once and shared by every impostor forest. */
function useImpostorAtlas() {
  const gl = useThree((s) => s.gl)
  const tex = useTexture({
    fir: ASSETS.fir.twigDiff,
    firAlpha: ASSETS.fir.twigAlpha,
    pine: ASSETS.pine.twigDiff,
    pineAlpha: ASSETS.pine.twigAlpha,
    bark: ASSETS.fir.barkDiff,
  })
  return useMemo(() => atlasFor(gl, tex), [gl, tex])
}

interface ImpostorTree {
  x: number
  y: number
  z: number
  height: number
  larch: boolean
  shade: number
}

function buildGeometry(trees: ImpostorTree[]) {
  const rand = createRng(31337)
  const pos = new Float32Array(trees.length * 3)
  const size = new Float32Array(trees.length * 2)
  const kind = new Float32Array(trees.length)
  const shade = new Float32Array(trees.length)
  trees.forEach((t, i) => {
    pos.set([t.x, t.y, t.z], i * 3)
    const widthFactor = t.larch ? 1 : 1.15
    size.set([t.height * ASPECT * 1.04 * widthFactor * (0.9 + rand() * 0.2), t.height], i * 2)
    kind[i] = (t.larch ? 0 : 2) + (rand() < 0.5 ? 0 : 1)
    shade[i] = t.shade
  })
  const base = new PlaneGeometry(1, 1).translate(0, 0.5, 0)
  const g = new InstancedBufferGeometry()
  g.index = base.index
  g.setAttribute('position', base.attributes.position as BufferAttribute)
  g.setAttribute('uv', base.attributes.uv as BufferAttribute)
  g.setAttribute('aPos', new InstancedBufferAttribute(pos, 3))
  g.setAttribute('aSize', new InstancedBufferAttribute(size, 2))
  g.setAttribute('aKind', new InstancedBufferAttribute(kind, 1))
  g.setAttribute('aShade', new InstancedBufferAttribute(shade, 1))
  g.instanceCount = trees.length
  return g
}

/** The real forest on the slopes beyond the local scene, from the orthophoto. */
function farTrees(): ImpostorTree[] {
  const { treesFar, meta } = world()
  const rand = createRng(31337)
  const out: ImpostorTree[] = []
  for (let i = 0; i < treesFar.length; i += 4) {
    const x = treesFar[i]
    const z = treesFar[i + 2]
    if (Math.hypot(x, z) < meta.local.half - 5) continue // the local forest covers this
    const larch = rand() < 0.6
    const height = (larch ? 15 + rand() * 9 : 9 + rand() * 6) * treesFar[i + 3]
    out.push({ x, y: treesFar[i + 1] - 1.2, z, height, larch, shade: 0.8 + rand() * 0.35 })
  }
  return out
}

function createImpostorMaterial(local: boolean) {
  const { r0, rMax } = world().meta
  return new ShaderMaterial({
    defines: local ? { LOCAL_SCENE: '' } : {},
    uniforms: { ...terrainUniforms, uAtlas: { value: null }, uCamReal: { value: new Vector3() } },
    vertexShader: /* glsl */ `
      attribute vec3 aPos;
      attribute vec2 aSize;
      attribute float aKind;
      attribute float aShade;
      uniform vec3 uCamReal;
      uniform sampler2D uShadow;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vSunVis;
      varying float vShade;
      varying float vAltitude;
      uniform float uCampAltitude;
      void main() {
        vec3 toCam = uCamReal - aPos;
        toCam.y = 0.0;
        vec3 fwd = normalize(toCam);
        vec3 right = vec3(fwd.z, 0.0, -fwd.x);
        vec3 p = aPos + right * position.x * aSize.x + vec3(0.0, position.y * aSize.y, 0.0);
        vUv = vec2((uv.x + aKind) / ${CELLS.toFixed(1)}, uv.y);
        vNormal = normalize(fwd * 0.55 + vec3(0.0, 0.8, 0.0));
        vShade = aShade;
        vAltitude = aPos.y + uCampAltitude;
        // terrain shadow at the tree (baked for the real evening sun), in polar texture space
        float r = length(aPos.xz);
        float u = fract(atan(aPos.x, -aPos.z) / 6.2831853);
        float v = log(r / ${r0.toFixed(1)}) / log(${(rMax / r0).toFixed(4)});
        vSunVis = texture2D(uShadow, vec2(u, clamp(v, 0.0, 1.0))).r;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vSunVis;
      varying float vShade;
      varying float vAltitude;
      ${TERRAIN_GLSL}
      void main() {
        vec4 t = texture2D(uAtlas, vUv);
        if (t.a < 0.5) discard;
        vec3 albedo = t.rgb * vShade;
        float ndl = max(dot(vNormal, uSunDir), 0.0) * 0.8 + 0.2;
        vec3 color = albedo * (uSunColor * ndl * vSunVis + skyLight(vNormal) * 1.2);
        vec3 toFrag = vWorld - cameraPosition;
        float len = max(length(toFrag), 1e-5);
        #ifdef LOCAL_SCENE
          // part of the local scene: true scale and depth
          gl_FragColor = vec4(aerialPerspective(color, toFrag / len, len, vAltitude), 1.0);
        #else
          float dist = len / uScale;
          gl_FragColor = vec4(aerialPerspective(color, toFrag / len, dist, vAltitude), 1.0);
          gl_FragDepth = terrainDepth(dist);
        #endif
      }`,
    side: DoubleSide,
  })
}

function ImpostorMesh({ trees, local }: { trees: ImpostorTree[]; local: boolean }) {
  const atlasTexture = useImpostorAtlas()
  const geometry = useMemo(() => buildGeometry(trees), [trees])
  const material = useMemo(() => createImpostorMaterial(local), [local])
  useEffect(() => {
    material.uniforms.uAtlas.value = atlasTexture
  }, [material, atlasTexture])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(({ camera }) => {
    material.uniforms.uCamReal.value.copy(camera.position)
  })
  return <mesh geometry={geometry} material={material} renderOrder={local ? 0 : 1} frustumCulled={false} />
}

/** Distant forest on the real slopes (inside the scaled terrain group). */
export function FarForest() {
  const trees = useMemo(() => farTrees(), [])
  return <ImpostorMesh trees={trees} local={false} />
}

/** Local trees beyond the detail range, as cheap impostors with true depth. */
export function LocalImpostors({ trees }: { trees: TreeInstance[] }) {
  const items = useMemo(
    () => trees.map((t) => ({ x: t.x, y: heightAt(t.x, t.z) - 0.3, z: t.z, height: t.height, larch: t.species === 'larch', shade: t.shade })),
    [trees],
  )
  return <ImpostorMesh trees={items} local />
}
