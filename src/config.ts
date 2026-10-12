// All tunable values for the feel of Bonfire live here.

export const WORLD = {
  seed: 1337, // shared seed so every client sees the same forest
  radius: 60, // soft boundary for players
  boundaryPush: 6, // how strongly players are pushed back past the boundary
  groundSize: 220,
  groundSegments: 96,
  groundBump: 0.35, // vertex displacement amplitude
}

export const COLORS = {
  background: '#05070d',
  ground: '#a3b1c7',
  fire: '#ff8a3d',
  moon: '#9fb4ff',
  ambient: '#1a2340',
}

export const FOG = {
  density: 0.045, // FogExp2: trees fade out around 25–35 units
}

export const LIGHTING = {
  ambientIntensity: 0.12,
  hemiSky: '#2a3a66',
  hemiGround: '#0a0c14',
  hemiIntensity: 0.32,
  moonIntensity: 0.5,
  moonPosition: [-40, 60, -80] as [number, number, number],
}

export const TREES = {
  count: 220,
  clearingRadius: 8, // no trees inside this radius around the fire
  spawnRadius: 75, // trees scattered up to this distance
  minSpacing: 2.2,
  trunkRadius: 0.35, // collision radius of a trunk
  minScale: 0.8,
  maxScale: 1.6,
  cameraFadeNear: 3, // trees closer than this to the camera are fully hidden
  cameraFadeFar: 6.5, // ...and fully visible beyond this
  occlusionFade: 0.13, // screen-space radius around the player where blocking trees dither away
}

export const MOUNTAINS = {
  distance: 110,
  count: 14,
}

export const SNOW = {
  count: 1400,
  area: 40, // cube size around the camera
  height: 22,
  fallSpeed: 0.9,
  drift: 0.35,
  size: 0.07,
}

export const FIRE = {
  lightColor: '#ff8a3d',
  lightIntensity: 30,
  lightDistance: 30,
  lightDecay: 2,
  lightHeight: 1.6,
  flickerAmount: 0.28, // fraction of intensity that flickers
  flickerSpeed: 1.0,
  stoneRingRadius: 1.35,
  collisionRadius: 1.8, // players can't walk into the fire
  emberCount: 70,
  emberRiseSpeed: 1.2,
  emberLifetime: 3.2,
}

export const BLOOM = {
  intensity: 0.9,
  luminanceThreshold: 0.6,
  luminanceSmoothing: 0.25,
  vignetteDarkness: 0.75,
  vignetteOffset: 0.3,
}

export const PLAYER = {
  walkSpeed: 3.6,
  slowSpeed: 1.6, // with Shift
  acceleration: 10, // higher = snappier start
  deceleration: 8,
  turnSpeed: 10, // rotation lerp factor
  radius: 0.4, // collision radius
  spawnMinRadius: 9,
  spawnMaxRadius: 13,
}

export const SITTING = {
  distance: 4, // within this distance of the fire
  delay: 1.0, // seconds still before sitting
  lowerBy: 0.22,
}

export const CAMERA = {
  distance: 7.5,
  height: 3.6,
  nearFireDistance: 5.2, // zoom when close to the fire
  nearFireHeight: 3.0,
  nearFireRadius: 6,
  followLerp: 4,
  lookHeight: 1.5,
  fov: 55,
}

const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export const RENDER = {
  maxDpr: isTouch ? 1.5 : 1.75,
  msaa: isTouch ? 0 : 4, // multisampling for the postprocessing pass
}
