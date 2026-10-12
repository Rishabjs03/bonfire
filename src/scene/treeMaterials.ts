import { DoubleSide, MeshStandardMaterial, Vector3, type Texture } from 'three'
import { TREES } from '../config'

/** Shared uniforms: wind time and the player's position in view space (for see-through). */
export const treeUniforms = { uTime: { value: 0 }, uPlayerView: { value: new Vector3() } }

/**
 * Trees right next to the camera, or standing between the camera and the player,
 * dissolve with an ordered dither (no transparency sorting needed).
 */
const DITHER_FADE = /* glsl */ `
  {
    float camDist = length(vViewPosition);
    float keep = smoothstep(${TREES.cameraFadeNear.toFixed(2)}, ${TREES.cameraFadeFar.toFixed(2)}, camDist);
    vec3 fragView = -vViewPosition;
    if (-fragView.z < -uPlayerView.z - 0.8) {
      vec2 a = fragView.xy / -fragView.z;
      vec2 b = uPlayerView.xy / -uPlayerView.z;
      vec2 d = (a - b) * vec2(1.0, 0.6);
      keep = min(keep, mix(0.12, 1.0, smoothstep(0.1, 0.22, length(d))));
    }
    if (keep < 0.999) {
      ivec2 p = ivec2(mod(gl_FragCoord.xy, 4.0));
      float bayer[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
      if (keep < (bayer[p.x + p.y * 4] + 0.5) / 16.0) discard;
    }
  }
`

export function createFoliageMaterial(map: Texture, alphaMap: Texture, dither = true) {
  const m = new MeshStandardMaterial({
    map,
    alphaMap,
    alphaTest: 0.42,
    alphaToCoverage: dither,
    side: DoubleSide,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
    envMapIntensity: 0.55, // needles are matte; avoid a frosty sky sheen
  })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = treeUniforms.uTime
    shader.uniforms.uPlayerView = treeUniforms.uPlayerView
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float uTime;\nvoid main() {')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float phase = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
        #else
          float phase = 0.0;
        #endif
        float reach = length(position.xz);
        float sway = sin(uTime * 0.9 + phase + position.y * 0.15) * 0.5 + sin(uTime * 2.3 + phase * 1.7) * 0.2;
        transformed.x += sway * 0.014 * reach * (0.3 + position.y * 0.05);
        transformed.y += sin(uTime * 1.7 + phase + reach) * 0.006 * reach;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 uPlayerView;\nvoid main() {')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${dither ? DITHER_FADE : ''}`)
      // Translucent needles glow when the low sun is behind them.
      .replace(
        '#include <lights_fragment_end>',
        /* glsl */ `#include <lights_fragment_end>
        #if NUM_DIR_LIGHTS > 0
        {
          vec3 L = directionalLights[0].direction;
          vec3 V = normalize(vViewPosition);
          float back = pow(max(dot(-V, L), 0.0), 3.0); // looking toward the sun through the needles
          reflectedLight.directDiffuse += diffuseColor.rgb * vec3(1.0, 1.05, 0.7) * directionalLights[0].color * back * 0.16;
        }
        #endif`,
      )
      // Cards use rounded crown normals: don't flip them on back faces.
      .replace(
        '#include <normal_fragment_begin>',
        /* glsl */ `float faceDirection = gl_FrontFacing ? 1.0 : -1.0;
        vec3 normal = normalize( vNormal );
        vec3 nonPerturbedNormal = normal;`,
      )
  }
  return m
}

export function createBarkMaterial(map: Texture, normalMap: Texture, color: string) {
  const m = new MeshStandardMaterial({ map, normalMap, roughness: 0.95, metalness: 0, color })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uPlayerView = treeUniforms.uPlayerView
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 uPlayerView;\nvoid main() {')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${DITHER_FADE}`)
  }
  return m
}
