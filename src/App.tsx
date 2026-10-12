import { Canvas } from '@react-three/fiber'
import { CAMERA, POST, RENDER } from './config'
import { useMultiplayer } from './net/useMultiplayer'
import { useKeyboardControls } from './player/useControls'
import { DISTANT_LAYER, FAR_LAYER } from './scene/Trees'
import { World } from './scene/World'
import { useGameStore } from './store/gameStore'
import { FullScreen } from './ui/FullScreen'
import { HUD } from './ui/HUD'
import { JoinScreen } from './ui/JoinScreen'
import { labelLayerRef } from './ui/labelLayer'
import { OnlineCounter } from './ui/OnlineCounter'

export default function App() {
  useKeyboardControls()
  useMultiplayer()
  const phase = useGameStore((s) => s.phase)

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
      {phase === 'joined' && (
        <>
          <HUD />
          <OnlineCounter />
        </>
      )}
      {phase === 'lobby' && <JoinScreen />}
      {phase === 'full' && <FullScreen />}
    </div>
  )
}
