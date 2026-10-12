import { Vector3 } from 'three'
import { SKY, VIEW_DIR } from '../config'

const deg = Math.PI / 180

/** Azimuth (three's equirect angle, atan2(z, x)) of the moon in world space. */
export const MOON_AZIMUTH = Math.atan2(VIEW_DIR.z, VIEW_DIR.x) + SKY.moonAzimuthOffset * deg
const elevation = SKY.moonElevation * deg

/** Unit vector pointing at the moon. */
export const MOON_DIR = new Vector3(
  Math.cos(elevation) * Math.cos(MOON_AZIMUTH),
  Math.sin(elevation),
  Math.cos(elevation) * Math.sin(MOON_AZIMUTH),
)

/** Y rotation that lines the HDRI's moon glow up with MOON_DIR. */
export const SKY_ROTATION_Y = SKY.hdrMoonAzimuth * deg - MOON_AZIMUTH
