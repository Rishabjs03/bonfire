import { Color } from 'three'
import { SUN, TERRAIN } from '../config'
import { SUN_DIR } from '../world/directions'
import { world } from '../world/worldData'

/** Shared by the terrain and the far forest so they light and haze identically. */
export const terrainUniforms = {
  uSunDir: { value: SUN_DIR },
  uSunColor: { value: new Color(SUN.color).multiplyScalar(SUN.intensity / Math.PI) },
  uSkyUp: { value: new Color('#7f97bd').multiplyScalar(0.24) },
  uSkyHorizon: { value: new Color('#c4ad98').multiplyScalar(0.22) },
  uGroundBounce: { value: new Color('#6a6152').multiplyScalar(0.1) },
  uHaze: { value: new Color(TERRAIN.hazeColor).multiplyScalar(0.62) },
  uHazeSun: { value: new Color(TERRAIN.hazeSunColor).multiplyScalar(1.0) },
  uHazeDistance: { value: TERRAIN.hazeDistance },
  uScale: { value: TERRAIN.scale },
  uShadow: { value: null as unknown },
  uCampAltitude: { value: world().meta.campAltitude },
}

/** GLSL shared by terrain-like shaders: sky light, aerial perspective and depth placement. */
export const TERRAIN_GLSL = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyUp;
  uniform vec3 uSkyHorizon;
  uniform vec3 uGroundBounce;
  uniform vec3 uHaze;
  uniform vec3 uHazeSun;
  uniform float uHazeDistance;
  uniform float uScale;
  uniform float uCampAltitude;

  vec3 skyLight(vec3 n) {
    vec3 sky = mix(uSkyHorizon, uSkyUp, clamp(n.y, 0.0, 1.0));
    return mix(uGroundBounce, sky, n.y * 0.5 + 0.5);
  }

  vec3 aerialPerspective(vec3 color, vec3 viewDir, float dist, float altitude) {
    float sunward = pow(max(dot(viewDir, uSunDir), 0.0), 8.0);
    vec3 haze = mix(uHaze, uHazeSun, sunward);
    // thinner air higher up: peaks stay crisper than the valley
    float density = exp(-max(altitude - 2000.0, 0.0) / 2600.0);
    float amount = 1.0 - exp(-dist / uHazeDistance * (0.55 + 0.75 * density));
    return mix(color, haze, amount);
  }

  // Always behind the local scene, but correctly ordered among themselves (real distance).
  float terrainDepth(float dist) {
    return 0.9996 + 0.0003999 * clamp(dist / 30000.0, 0.0, 1.0);
  }
`

