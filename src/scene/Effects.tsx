import { Bloom, EffectComposer, N8AO, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { POST, RENDER } from '../config'
import { enabled } from '../lib/debug'
import { FireHaze } from './fire/FireHaze'

export function Effects() {
  return (
    <EffectComposer multisampling={RENDER.msaa}>
      {enabled('ao') ? (
        <N8AO aoRadius={POST.aoRadius} intensity={POST.aoIntensity} distanceFalloff={0.6} quality="medium" halfRes />
      ) : (
        <></>
      )}
      <FireHaze />
      <Bloom
        mipmapBlur
        intensity={POST.bloomIntensity}
        luminanceThreshold={POST.bloomThreshold}
        luminanceSmoothing={POST.bloomSmoothing}
      />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Vignette offset={POST.vignetteOffset} darkness={POST.vignetteDarkness} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={POST.grain} />
    </EffectComposer>
  )
}
