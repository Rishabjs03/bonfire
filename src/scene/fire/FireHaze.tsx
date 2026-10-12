import { forwardRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Color, Matrix4, Uniform, Vector3 } from 'three'
import { FIRE, FOG } from '../../config'
import { fireState } from '../fireState'

/**
 * Light from the fire scattering in the cold night air. For every pixel we integrate
 * in-scattering from a point light along the view ray up to the visible surface
 * (closed form), so the glow wraps around anything between you and the fire.
 */
const fragmentShader = /* glsl */ `
uniform mat4 uProjInv;
uniform vec3 uFireView;
uniform vec3 uFireColor;
uniform float uStrength;
uniform float uFogDensity;

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec4 farPoint = uProjInv * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  vec3 dir = normalize(farPoint.xyz / farPoint.w);
  float viewZ = getViewZ(depth);
  float t = depth >= 0.9995 ? 30.0 : min(viewZ / dir.z, 60.0);

  float b = dot(uFireView, dir);
  vec3 closest = dir * b;
  float h = max(length(uFireView - closest), 0.15);
  float scatter = (atan((t - b) / h) - atan(-b / h)) / h;
  // extinction through the fog between camera and fire
  float ext = exp(-max(b, 0.0) * uFogDensity * 1.5);
  vec3 glow = uFireColor * scatter * uStrength * ext;
  outputColor = vec4(inputColor.rgb + glow, inputColor.a);
}
`

class FireHazeEffect extends Effect {
  constructor() {
    super('FireHazeEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['uProjInv', new Uniform(new Matrix4())],
        ['uFireView', new Uniform(new Vector3())],
        ['uFireColor', new Uniform(new Color(FIRE.lightColor).multiplyScalar(0.06))],
        ['uStrength', new Uniform(FIRE.hazeStrength)],
        ['uFogDensity', new Uniform(FOG.density)],
      ]),
    })
  }
}

export const FireHaze = forwardRef<FireHazeEffect>(function FireHaze(_, ref) {
  const effect = useMemo(() => new FireHazeEffect(), [])
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    const u = effect.uniforms
    ;(u.get('uProjInv')!.value as Matrix4).copy(camera.projectionMatrixInverse)
    ;(u.get('uFireView')!.value as Vector3).copy(fireState.position).applyMatrix4(camera.matrixWorldInverse)
    u.get('uStrength')!.value = FIRE.hazeStrength * fireState.flicker
  })
  return <primitive ref={ref} object={effect} dispose={null} />
})
