import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BoxGeometry, FrontSide, Mesh, ShaderMaterial, Vector3 } from 'three'
import { BLACKBODY, SIMPLEX_3D } from '../../lib/glsl'
import { useQuality } from '../../store/quality'
import { fireState } from '../fireState'

const WIDTH = 1.3
const HEIGHT = 2.1

/**
 * Raymarched volumetric flames inside a box. Density comes from rising, swirling
 * 3D noise shaped into a tapering envelope that breaks into tongues near the top;
 * colour comes from a blackbody temperature ramp. Rendered additively in HDR so
 * bloom and tone mapping turn it into a believable, glowing fire.
 */
function createFireMaterial(STEPS: number) {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCamLocal: { value: new Vector3() },
      uIntensity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uCamLocal;
      uniform float uIntensity;
      varying vec3 vLocal;
      const float W = ${(WIDTH / 2).toFixed(3)};
      const float H = ${HEIGHT.toFixed(3)};
      ${SIMPLEX_3D}
      ${BLACKBODY}

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      // returns (temperature, density)
      vec2 fire(vec3 p) {
        float h = p.y / H;
        vec3 np = vec3(p.x * 2.4, p.y * 1.5 - uTime * 2.7, p.z * 2.4);
        float n = fbm3(np);
        float n2 = snoise(np * 1.7 + vec3(5.2, -uTime * 1.1, 1.1));
        vec2 q = p.xz + vec2(n, n2) * (0.06 + 0.3 * h);
        // slow lean, as if a breath of wind moves through the clearing
        q.x += sin(uTime * 0.7) * 0.06 * h * h;
        float r = length(q);
        float width = 0.44 * pow(max(1.0 - h, 0.0), 0.8) + 0.015;
        float shape = 1.0 - smoothstep(width * 0.3, width, r);
        float tongues = smoothstep(-0.3, 0.35, n * 1.1 + (0.5 - h) * 1.2);
        float d = shape * tongues * smoothstep(0.0, 0.06, h);
        float temp = d * (1.25 - h * 0.95) * (0.8 + 0.4 * n2) * (1.0 - r / (width + 0.001) * 0.35);
        return vec2(temp, d);
      }

      vec2 boxHit(vec3 ro, vec3 rd) {
        vec3 bmin = vec3(-W, 0.0, -W);
        vec3 bmax = vec3(W, H, W);
        vec3 inv = 1.0 / rd;
        vec3 t0 = (bmin - ro) * inv;
        vec3 t1 = (bmax - ro) * inv;
        vec3 tmin = min(t0, t1);
        vec3 tmax = max(t0, t1);
        return vec2(max(max(tmin.x, tmin.y), tmin.z), min(min(tmax.x, tmax.y), tmax.z));
      }

      void main() {
        vec3 rd = normalize(vLocal - uCamLocal);
        vec2 t = boxHit(uCamLocal, rd);
        float t0 = max(t.x, 0.0);
        float len = t.y - t0;
        if (len <= 0.0) discard;
        float stepLen = len / float(${STEPS});
        float jitter = hash12(gl_FragCoord.xy + fract(uTime) * 61.0);
        vec3 p = uCamLocal + rd * (t0 + stepLen * jitter);
        vec3 col = vec3(0.0);
        float trans = 1.0;
        for (int i = 0; i < ${STEPS}; i++) {
          vec2 f = fire(p);
          if (f.y > 0.002) {
            col += blackbody(f.x) * f.y * stepLen * 5.5 * trans;
            trans *= exp(-f.y * stepLen * 1.8);
          }
          p += rd * stepLen;
        }
        gl_FragColor = vec4(col * uIntensity, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: FrontSide,
  })
}

export function FireVolume() {
  const mesh = useRef<Mesh>(null!)
  const geometry = useMemo(() => new BoxGeometry(WIDTH, HEIGHT, WIDTH).translate(0, HEIGHT / 2, 0), [])
  const steps = useQuality((q) => q.settings.fireSteps)
  const material = useMemo(() => createFireMaterial(steps), [steps])
  const camLocal = useMemo(() => new Vector3(), [])

  useFrame(({ camera, clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uIntensity.value = 0.85 + (fireState.flicker - 1) * 0.6
    camLocal.copy(camera.position)
    mesh.current.worldToLocal(camLocal)
    material.uniforms.uCamLocal.value.copy(camLocal)
  })

  return <mesh ref={mesh} geometry={geometry} material={material} position={[0, 0.12, 0]} renderOrder={10} />
}
