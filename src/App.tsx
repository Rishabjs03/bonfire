import { Canvas } from '@react-three/fiber'
import { CAMERA, RENDER } from './config'
import { useKeyboardControls } from './player/useControls'
import { World } from './scene/World'
import { HUD } from './ui/HUD'
import { labelLayerRef } from './ui/labelLayer'

export default function App() {
  useKeyboardControls()

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, RENDER.maxDpr]}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: CAMERA.fov, near: 0.1, far: 400, position: [0, 5, 12] }}
      >
        <World />
      </Canvas>
      <div ref={labelLayerRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      <HUD />
    </div>
  )
}
