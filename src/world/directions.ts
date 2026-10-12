import { Vector3 } from 'three'
import { SKY } from '../config'
import { world } from './worldData'

const deg = Math.PI / 180
const { sun, matterhorn } = world().meta

/** Unit xz direction for a compass bearing (x = east, z = south). */
const fromBearing = (b: number) => ({ x: Math.sin(b * deg), z: -Math.cos(b * deg) })

/** Toward the Matterhorn from camp. */
export const VIEW_DIR = (() => {
  const l = Math.hypot(matterhorn.east, matterhorn.north)
  return { x: matterhorn.east / l, z: -matterhorn.north / l }
})()

/** Unit vector pointing at the sun (the real mid-September evening sun, baked with the terrain). */
export const SUN_DIR = (() => {
  const h = fromBearing(sun.bearing)
  const e = sun.elevation * deg
  return new Vector3(h.x * Math.cos(e), Math.sin(e), h.z * Math.cos(e))
})()

/** Y rotation that lines the HDRI's sun up with SUN_DIR (sampled dir = R⁻¹ · world dir). */
export const SKY_ROTATION_Y = SKY.hdrSunAzimuth * deg - Math.atan2(SUN_DIR.z, SUN_DIR.x)
