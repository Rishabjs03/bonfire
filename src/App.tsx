import { Canvas } from '@react-three/fiber'
import { CAMERA, POST, RENDER } from './config'
import { useKeyboardControls } from './player/useControls'
import { DISTANT_LAYER, FAR_LAYER } from './scene/Trees'
import { World } from './scene/World'
import { HUD } from './ui/HUD'
import { labelLayerRef } from './ui/labelLayer'

export default function App() {
  useKeyboardControls()

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, RENDER.maxDpr]}
        shadows="soft"
        flat
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far, position: [0, 2, 8] }}
        onCreated={({ camera, gl, scene }) => {
          camera.layers.enable(FAR_LAYER)
          camera.layers.enable(DISTANT_LAYER)
          gl.toneMappingExposure = POST.exposure
          if (import.meta.env.DEV) Object.assign(window, { __gl: gl, __scene: scene })
        }}
      >
        <World />
      </Canvas>
      <div ref={labelLayerRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      <HUD />
    </div>
  )
}
