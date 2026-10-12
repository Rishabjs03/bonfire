import { Suspense } from 'react'
import { AudioDriver } from '../audio/AudioDriver'
import { RadioPlayer } from '../audio/RadioPlayer'
import { FOG } from '../config'
import { enabled } from '../lib/debug'
import { CameraRig } from '../player/CameraRig'
import { LocalPlayer } from '../player/LocalPlayer'
import { RemotePlayers } from '../player/RemotePlayer'
import { useGameStore } from '../store/gameStore'
import { AlpineTerrain } from './AlpineTerrain'
import { Bonfire } from './Bonfire'
import { Camp } from './Camp'
import { Effects } from './Effects'
import { Ground } from './Ground'
import { Sky } from './Sky'
import { Grass } from './Grass'
import { Rocks } from './Rocks'
import { Trees } from './Trees'

export function World() {
  const joined = useGameStore((s) => s.phase === 'joined')
  return (
    <>
      <fogExp2 attach="fog" args={[FOG.color, FOG.density]} />
      <Suspense fallback={null}>
        {enabled('sky') && <Sky />}
        {enabled('terrain') && <AlpineTerrain />}
        <Ground />
        {enabled('trees') && <Trees />}
        <Bonfire />
        <Camp />
        {enabled('grass') && <Grass />}
        {enabled('rocks') && <Rocks />}
        {joined && <LocalPlayer />}
        <RemotePlayers />
        <CameraRig />
        <AudioDriver />
        <RadioPlayer />
        {enabled('post') && <Effects />}
      </Suspense>
    </>
  )
}
