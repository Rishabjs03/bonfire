import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { BLOOM, RENDER } from '../config'

export function Effects() {
  return (
    <EffectComposer multisampling={RENDER.msaa}>
      <Bloom
        mipmapBlur
        intensity={BLOOM.intensity}
        luminanceThreshold={BLOOM.luminanceThreshold}
        luminanceSmoothing={BLOOM.luminanceSmoothing}
      />
      <Vignette offset={BLOOM.vignetteOffset} darkness={BLOOM.vignetteDarkness} />
    </EffectComposer>
  )
}
