import { COLORS, FOG } from '../config'
import { CameraRig } from '../player/CameraRig'
import { LocalPlayer } from '../player/LocalPlayer'
import { Bonfire } from './Bonfire'
import { Effects } from './Effects'
import { Ground } from './Ground'
import { Mountains } from './Mountains'
import { Sky } from './Sky'
import { Snow } from './Snow'
import { Trees } from './Trees'

export function World() {
  return (
    <>
      <color attach="background" args={[COLORS.background]} />
      <fogExp2 attach="fog" args={[COLORS.background, FOG.density]} />

      <Sky />
      <Mountains />
      <Ground />
      <Trees />
      <Bonfire />
      <Snow />

      <LocalPlayer />
      <CameraRig />

      <Effects />
    </>
  )
}
