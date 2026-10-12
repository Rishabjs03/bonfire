import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { CAMERA, POST, RENDER } from './config'
import { useMultiplayer } from './net/useMultiplayer'
import { useKeyboardControls } from './player/useControls'
import { DISTANT_LAYER, FAR_LAYER } from './scene/Trees'
import { World } from './scene/World'
import { useGameStore } from './store/gameStore'
import { ChatInput } from './ui/ChatInput'
import { FullScreen } from './ui/FullScreen'
import { HUD } from './ui/HUD'
import { JoinScreen } from './ui/JoinScreen'
import { labelLayerRef } from './ui/labelLayer'
import { isTouchDevice } from './ui/isTouch'
import { TouchControls } from './ui/Joystick'
import { MuteButton } from './ui/MuteButton'
import { OnlineCounter } from './ui/OnlineCounter'
import { useHotkeys } from './ui/useHotkeys'

export default function App() {
  useKeyboardControls()
  useMultiplayer()
  useHotkeys()
  const phase = useGameStore((s) => s.phase)
  // Drop resolution when the frame rate struggles; restore it when there's headroom.
  const [dpr, setDpr] = useState(RENDER.maxDpr)

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={dpr}
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
        <PerformanceMonitor
          onDecline={() => setDpr(1)}
          onIncline={() => setDpr(RENDER.maxDpr)}
          flipflops={3}
          onFallback={() => setDpr(1)}
        >
          <World />
        </PerformanceMonitor>
      </Canvas>
      <div ref={labelLayerRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      {phase === 'joined' && (
        <>
          <HUD />
          <OnlineCounter />
          <ChatInput />
          {isTouchDevice && <TouchControls />}
        </>
      )}
      {phase === 'lobby' && <JoinScreen />}
      {phase === 'full' && <FullScreen />}
      <MuteButton />
    </div>
  )
}
