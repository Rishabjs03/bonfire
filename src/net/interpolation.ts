import { NET } from '../config'
import { lerpAngle } from '../lib/math'

export interface Snapshot {
  t: number // local receive time, ms
  x: number
  z: number
  rotY: number
  vx: number
  vz: number
}

const MAX_SNAPSHOTS = 12

/**
 * Buffered interpolation: remote players are rendered slightly in the past, between
 * two received snapshots, so movement stays smooth even at low and jittery send rates.
 * The delay adapts to how often that player is actually sending.
 */
export class SnapshotBuffer {
  private snaps: Snapshot[] = []
  private avgInterval = 150

  push(s: Snapshot) {
    const last = this.snaps[this.snaps.length - 1]
    if (last) {
      const dt = Math.min(s.t - last.t, 5000)
      this.avgInterval += (dt - this.avgInterval) * 0.2
    }
    this.snaps.push(s)
    if (this.snaps.length > MAX_SNAPSHOTS) this.snaps.shift()
  }

  /** Jump straight to a position (spawn, or a resting position from presence). */
  reset(s: Snapshot) {
    this.snaps = [s]
  }

  get latest(): Snapshot | undefined {
    return this.snaps[this.snaps.length - 1]
  }

  /** Writes the interpolated pose at local time `now` into `out`. Returns false if empty. */
  sample(now: number, out: { x: number; z: number; rotY: number }) {
    const snaps = this.snaps
    if (snaps.length === 0) return false
    const delay = Math.min(NET.interpolationMax, Math.max(NET.interpolationMin, this.avgInterval * 1.3 + 40))
    const t = now - delay

    if (t <= snaps[0].t || snaps.length === 1) {
      out.x = snaps[0].x
      out.z = snaps[0].z
      out.rotY = snaps[0].rotY
      return true
    }
    for (let i = snaps.length - 1; i > 0; i--) {
      const a = snaps[i - 1]
      const b = snaps[i]
      if (t >= a.t) {
        if (t <= b.t) {
          const k = (t - a.t) / Math.max(1, b.t - a.t)
          out.x = a.x + (b.x - a.x) * k
          out.z = a.z + (b.z - a.z) * k
          out.rotY = lerpAngle(a.rotY, b.rotY, k)
        } else {
          // Past the newest snapshot: coast briefly along its velocity, then hold.
          const ahead = Math.min((t - b.t) / 1000, 0.25)
          out.x = b.x + b.vx * ahead
          out.z = b.z + b.vz * ahead
          out.rotY = b.rotY
        }
        return true
      }
    }
    return true
  }
}
