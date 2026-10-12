import { PLAYER } from '../config'
import { VIEW_DIR } from '../world/directions'
import { heightAt } from '../lib/terrain'
import { localRuntime } from '../store/gameStore'
import { resolveCollisions } from './collision'

/** Place the local player across the fire from the Matterhorn, facing the fire. */
export function spawnLocalPlayer() {
  const angle = Math.atan2(-VIEW_DIR.x, -VIEW_DIR.z) + (Math.random() - 0.5) * 0.9
  const r = PLAYER.spawnMinRadius + Math.random() * (PLAYER.spawnMaxRadius - PLAYER.spawnMinRadius)
  const rt = localRuntime
  rt.position.set(Math.sin(angle) * r, 0, Math.cos(angle) * r)
  for (let i = 0; i < 4; i++) resolveCollisions(rt.position, PLAYER.radius, 1)
  rt.position.y = heightAt(rt.position.x, rt.position.z)
  rt.velocity.set(0, 0, 0)
  rt.rotY = Math.atan2(-rt.position.x, -rt.position.z)
  rt.cameraYaw = rt.rotY
  rt.lookYaw = rt.rotY
  rt.sitting = false
  rt.moving = false
  rt.spawned = true
}
