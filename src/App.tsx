import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { CAMERA, POST } from './config'
import { useMultiplayer } from './net/useMultiplayer'
import { useKeyboardControls } from './player/useControls'
import { DISTANT_LAYER, FAR_LAYER } from './scene/layers'
import { Capture } from './scene/Capture'
import { World } from './scene/World'
import { useGameStore } from './store/gameStore'
import { useQuality } from './store/quality'
import { ChatInput } from './ui/ChatInput'
import { EmbedPlayer, RadioPanel, RadioPrompt } from './ui/RadioPanel'
import { FullScreen } from './ui/FullScreen'
import { HUD } from './ui/HUD'
import { JoinScreen } from './ui/JoinScreen'
import { labelLayerRef } from './ui/labelLayer'
import { isTouchDevice } from './ui/isTouch'
import { TouchControls } from './ui/Joystick'
import { MuteButton } from './ui/MuteButton'
import { OnlineCounter } from './ui/OnlineCounter'
import { PostcardButton } from './ui/PostcardButton'
import { useHotkeys } from './ui/useHotkeys'

export default function App() {
  useKeyboardControls()
  useMultiplayer()
  useHotkeys()
  const phase = useGameStore((s) => s.phase)
  // Quality starts from a GPU guess and steps down while the frame rate struggles.
  const dpr = useQuality((q) => Math.min(q.settings.dpr, window.devicePixelRatio || 1))
  const stepDown = useQuality((q) => q.stepDown)
  const stepUp = useQuality((q) => q.stepUp)

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
          bounds={(refresh) => [Math.min(45, refresh * 0.72), refresh * 0.97]}
          onDecline={stepDown}
          onIncline={stepUp}
          flipflops={3}
          onFallback={stepDown}
        >
          <World />
        </PerformanceMonitor>
        <Capture />
      </Canvas>
      <div ref={labelLayerRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      {phase === 'joined' && (
        <>
          <HUD />
          <OnlineCounter />
          <PostcardButton />
          <ChatInput />
          <RadioPrompt />
          <RadioPanel />
          {isTouchDevice && <TouchControls />}
        </>
      )}
      {phase === 'lobby' && <JoinScreen />}
      {phase === 'full' && <FullScreen />}
      <EmbedPlayer />
      <MuteButton />
      <p className="on-scene pointer-events-none absolute bottom-2 right-3 z-10 text-[10px] tracking-[0.02em] text-ink-faint">
        Terrain &amp; imagery © swisstopo
      </p>
    </div>
  )
}
