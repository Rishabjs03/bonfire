import { Suspense } from 'react'
import { AudioDriver } from '../audio/AudioDriver'
import { FOG } from '../config'
import { enabled } from '../lib/debug'
import { CameraRig } from '../player/CameraRig'
import { LocalPlayer } from '../player/LocalPlayer'
import { RemotePlayers } from '../player/RemotePlayer'
import { useGameStore } from '../store/gameStore'
import { AlpineTerrain } from './AlpineTerrain'
import { Bonfire } from './Bonfire'
import { Effects } from './Effects'
import { Ground } from './Ground'
import { Sky } from './Sky'
import { Snow } from './Snow'
import { Trees } from './Trees'

export function World() {
  const joined = useGameStore((s) => s.phase === 'joined')
  return (
    <>
      <fogExp2 attach="fog" args={[FOG.color, FOG.density]} />
      <Suspense fallback={null}>
        <Sky />
        {enabled('terrain') && <AlpineTerrain />}
        <Ground />
        {enabled('trees') && <Trees />}
        <Bonfire />
        {enabled('snow') && <Snow />}
        {joined && <LocalPlayer />}
        <RemotePlayers />
        <CameraRig />
        <AudioDriver />
        {enabled('post') && <Effects />}
      </Suspense>
    </>
  )
}
