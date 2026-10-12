import { Bloom, EffectComposer, N8AO, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { POST } from '../config'
import { enabled } from '../lib/debug'
import { useQuality } from '../store/quality'
import { FireHaze } from './fire/FireHaze'

export function Effects() {
  const msaa = useQuality((q) => q.settings.msaa)
  const ao = useQuality((q) => q.settings.ao)
  return (
    <EffectComposer multisampling={msaa}>
      {ao && enabled('ao') ? (
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
