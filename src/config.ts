// All tunable values for the feel of Bonfire live here. Units are metres.

/** Direction (xz, unit) from camp toward the Matterhorn: x = east, z = south. */
const toMatterhorn = { x: -7550, z: 3270 }
const len = Math.hypot(toMatterhorn.x, toMatterhorn.z)
export const VIEW_DIR = { x: toMatterhorn.x / len, z: toMatterhorn.z / len }

export const WORLD = {
  seed: 1337, // shared seed so every client sees the same forest
  radius: 55, // soft boundary for players
  boundaryPush: 6,
  groundSize: 260,
  groundSegments: 280,
  groundBump: 0.35, // gentle snow undulation
  viewSlopeStart: 16, // ground starts falling away toward the Matterhorn here
}

export const SKY = {
  hdr: '/assets/sky/night_2k.hdr',
  backgroundIntensity: 0.05,
  environmentIntensity: 0.16,
  hdrMoonAzimuth: 35.2, // degrees, where the moon glow sits in the HDRI (three's equirect angle)
  moonAzimuthOffset: 13, // degrees from the Matterhorn direction
  moonElevation: 17.6, // matches the HDRI
  moonSize: 1.2, // angular size multiplier (1 = real 0.5°)
  starCount: 4500,
}

export const MOONLIGHT = {
  color: '#9db4ff',
  intensity: 0.42,
  shadowMapSize: 2048,
  shadowRange: 38, // half-size of the shadow frustum around the player
}

export const TERRAIN = {
  url: '/assets/terrain/zermatt.bin',
  scale: 1 / 10, // distant terrain is drawn as a scaled backdrop around the camera
  holeRadius: 1350, // metres of real terrain around camp that are not drawn (local world covers it)
  snowLine: 2350,
  treeLine: 2250,
  haze: '#121a2b',
  hazeDistance: 16000,
}

export const FOG = {
  color: '#070a11',
  density: 0.024,
}

export const TREES = {
  count: 430,
  clearingRadius: 10.5,
  spawnRadius: 95,
  minSpacing: 3.4,
  viewWedge: 38, // degrees either side of the Matterhorn direction kept mostly open
  shadowCasterRadius: 24, // trees within this distance of the fire cast fire shadows
  moonShadowRadius: 50, // trees beyond this never cast shadows
  cameraFadeNear: 1.2,
  cameraFadeFar: 3.2,
}

export const SNOW = {
  count: 2600,
  area: 36,
  height: 18,
  fallSpeed: 0.75,
  drift: 0.3,
}

export const FIRE = {
  lightColor: '#ff7b2e',
  lightIntensity: 9, // candela, physically based
  lightHeight: 0.75,
  flickerAmount: 0.22,
  flickerSpeed: 1.0,
  pitScale: 1.55,
  collisionRadius: 1.45,
  sparkCount: 90,
  smokeCount: 26,
  hazeStrength: 0.32, // light scattering in the air around the fire
}

export const POST = {
  bloomIntensity: 0.55,
  bloomThreshold: 1.0,
  bloomSmoothing: 0.4,
  exposure: 1.35,
  aoRadius: 1.2,
  aoIntensity: 2.2,
  grain: 0.045,
  vignetteDarkness: 0.62,
  vignetteOffset: 0.28,
}

export const PLAYER = {
  walkSpeed: 1.55, // m/s, a slow wander through snow
  slowSpeed: 0.8,
  acceleration: 6,
  deceleration: 6,
  turnSpeed: 7,
  radius: 0.32,
  spawnMinRadius: 7,
  spawnMaxRadius: 9.5,
}

export const SITTING = {
  distance: 3.6,
  delay: 1.0,
}

export const CAMERA = {
  distance: 4.6,
  height: 1.75,
  nearFireDistance: 3.4,
  nearFireHeight: 1.35,
  nearFireRadius: 4.5,
  followLerp: 4,
  lookHeight: 1.35,
  shoulderOffset: 0.6, // over-the-shoulder framing so the character doesn't block the fire
  fov: 50,
  near: 0.08,
  far: 2600,
}

export const RENDER = {
  maxDpr: 1.5,
  msaa: 4,
}
