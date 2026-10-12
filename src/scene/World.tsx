import { Suspense } from 'react'
import { FOG } from '../config'
import { enabled } from '../lib/debug'
import { CameraRig } from '../player/CameraRig'
import { LocalPlayer } from '../player/LocalPlayer'
import { AlpineTerrain } from './AlpineTerrain'
import { Bonfire } from './Bonfire'
import { Effects } from './Effects'
import { Ground } from './Ground'
import { Sky } from './Sky'
import { Snow } from './Snow'
import { Trees } from './Trees'

export function World() {
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
        <LocalPlayer />
        <CameraRig />
        {enabled('post') && <Effects />}
      </Suspense>
    </>
  )
}
