// All tunable values for the feel of Bonfire live here. Units are metres.
// The place itself (terrain, forest, sun direction) is real and baked: see scripts/build-terrain.mjs.

export const WORLD = {
  seed: 1337,
  radius: 55, // soft boundary for players around the fire
  boundaryPush: 6,
  groundSize: 340, // local high-detail ground (the real terrain continues beyond)
  groundSegments: 300,
  firePitFlatten: 4.5, // ground is levelled within this radius of the fire
}

/**
 * 'sunset': the evening sun slips through a notch in the western ridge onto the meadow;
 *           the Matterhorn stands backlit against a golden sky.
 * 'sunrise': the camp is still in cool shade while the first sun turns the Matterhorn's
 *           east face gold (the famous alpenglow view from Riffelalp).
 */
export const TIME_OF_DAY: 'sunset' | 'sunrise' =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('time') === 'sunrise' ? 'sunrise' : 'sunset'

export const SKY = {
  hdr: '/assets/sky/golden_2k.hdr', // syferfontein_6d_clear_puresky (Poly Haven, CC0): sun 6.3° up
  hdrSunAzimuth: 35.2, // degrees, three's equirect angle of the sun in the HDRI
  backgroundIntensity: 1.0,
  environmentIntensity: 0.55,
}

export const SUN = {
  color: '#ffb874', // low sun through ~30 airmasses: warm, golden
  intensity: 3.2,
  shadowDepth: 600, // long low-sun shadows: casters far toward the sun count
}

export const TERRAIN = {
  scale: 1 / 10, // drawn as a camera-centred scaled copy (exact angles, no depth fighting)
  hazeDistance: 24000, // metres for ~63% aerial perspective (clear alpine air)
  hazeColor: '#a9b9d0', // bluish distance haze
  hazeSunColor: '#f1b98a', // warm haze toward the sun
  delight: 0.55, // how much of the orthophoto's baked midday shading to remove
}

export const FOG = {
  color: '#b3c0d2',
  density: 0.0016, // gentle haze in the local scene
}

export const TREES = {
  clearingRadius: 14.5, // no trees this close to the fire: keeps every camera angle from the benches clear
  viewCorridor: 26, // degrees either side of the Matterhorn direction kept clear
  sideCorridor: 24, // degrees either side of the view across the fire from each side bench
  cameraFadeNear: 1.2,
  cameraFadeFar: 4.5,
  larchShare: 0.58, // the rest are Swiss stone pines (Arven)
}

export const GRASS = {
  radius: 26, // default; the quality level sets count and radius
  height: 0.38,
  width: 0.032,
  flowerShare: 0.035,
}

export const FIRE = {
  lightColor: '#ff8a3d',
  lightIntensity: 7, // candela; modest against the evening sun
  lightHeight: 0.75,
  flickerAmount: 0.22,
  flickerSpeed: 1.0,
  pitScale: 1.55,
  collisionRadius: 1.45,
  sparkCount: 70,
  smokeCount: 26,
  hazeStrength: 0.08, // light scattering in the air: subtle in daylight
}

export const POST = {
  bloomIntensity: 0.45,
  bloomThreshold: 2.2,
  bloomSmoothing: 0.5,
  exposure: 0.9,
  aoRadius: 1.4,
  aoIntensity: 2.0,
  grain: 0.03,
  vignetteDarkness: 0.45,
  vignetteOffset: 0.3,
}

export const PLAYER = {
  walkSpeed: 1.45, // m/s, a slow wander through the meadow
  sprintSpeed: 4.4, // Shift + W
  acceleration: 6,
  deceleration: 6,
  turnSpeed: 7,
  radius: 0.32,
  spawnMinRadius: 6.5,
  spawnMaxRadius: 8.5,
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
  lookHeight: 1.45,
  shoulderOffset: 0.6, // over-the-shoulder framing so the character doesn't block the view
  fov: 50,
  near: 0.08,
  far: 2800,
  // Looking around is deliberately slow and heavy: input steers a target that the view eases toward.
  lookDrag: 4.5, // per second; lower = more lag after a swipe or drag
  dragSensitivity: 0.0032, // radians per pixel of mouse / touch drag
  swipeYaw: 0.0028, // radians per pixel of two-finger swipe
  swipePitch: 0.0019,
  orbitSpeed: 1.3, // radians per second from Q / E
}

export const NET = {
  channel: 'bonfire-main',
  maxPlayers: 50,
  /**
   * Project-wide Realtime message budget per second. Supabase Free allows 100/s and every
   * broadcast is delivered to each listener, so send rates adapt to stay under this.
   * Raise to ~400 on the Pro plan (500/s).
   */
  messageBudget: 60,
  maxSendHz: 10,
  minSendHz: 0.5,
  staleAfter: 10_000, // ms without updates before a moving player is considered stopped
  interpolationMin: 100, // ms of buffered delay for smooth remote movement
  interpolationMax: 2500,
}


/** Things to do with your hands while sitting on a log: see src/player/activity.ts. */
export const ACTIVITY = {
  /** Marshmallow doneness, seconds over the fire. */
  goldenAt: 5,
  brownAt: 11,
  burntAt: 17,
  stickLength: 1.15,
}

export const WILDLIFE = {
  cows: 6,
  cowMinRadius: 35, // metres from the fire: the far meadow
  cowMaxRadius: 75,
  cowRoam: 8, // how far a cow wanders from its spot before turning back
  cowWalkSpeed: 0.4, // m/s
  grazeMin: 8, // seconds head-down in the grass
  grazeMax: 25,
  walkMin: 4, // seconds of ambling between grazing spells
  walkMax: 10,
  marmots: 1,
  marmotRockMin: 15, // a big boulder this far from the fire
  marmotRockMax: 35,
  marmotAlarmSprint: 9, // metres: someone sprinting this close scares it
  marmotAlarmSpeed: 3, // m/s counts as sprinting
  marmotAlarmAny: 4, // metres: anyone this close scares it
  marmotBoltSpeed: 3.2, // m/s to the burrow
  burrowMin: 6, // metres from the rock
  burrowMax: 10,
  marmotReturnMin: 40, // seconds underground before it dares come back
  marmotReturnMax: 90,
}
