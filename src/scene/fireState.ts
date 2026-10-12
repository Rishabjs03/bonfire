import { Vector3 } from 'three'

/** Live fire state shared by everything lit by or reacting to the fire (haze, snow, glints). */
export const fireState = {
  position: new Vector3(0, 0.75, 0),
  /** Current light intensity multiplier (flicker), ~0.75..1.25. */
  flicker: 1,
}
