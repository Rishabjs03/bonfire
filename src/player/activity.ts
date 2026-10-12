import { ACTIVITY } from '../config'
import { myId, sendAct } from '../net/useMultiplayer'
import { localRuntime } from '../store/gameStore'
import { useSocialStore, type ActKind } from '../store/socialStore'
import { isRoastHeld } from './useControls'

/** What my hands are doing right now. */
export const myAct = (): ActKind => useSocialStore.getState().acts[myId]?.value ?? 'none'

/**
 * Called every frame by the local player: holding F on a log roasts a marshmallow, standing
 * up (or letting go) withdraws the stick.
 */
export function syncLocalAct() {
  const current = myAct()
  const wanted: ActKind = localRuntime.sitting && isRoastHeld() ? 'roast' : 'none'
  if (wanted !== current) sendAct(wanted) // rate limited inside; retried next frame if too soon
}

/** 0 fresh … 1 golden … 2 brown … 3 burnt (keeps climbing a little as it chars). */
export function doneness(startedAt: number, now = Date.now()) {
  const s = (now - startedAt) / 1000
  const { goldenAt, brownAt, burntAt } = ACTIVITY
  if (s < goldenAt) return s / goldenAt
  if (s < brownAt) return 1 + (s - goldenAt) / (brownAt - goldenAt)
  if (s < burntAt) return 2 + (s - brownAt) / (burntAt - brownAt)
  return 3 + Math.min(1, (s - burntAt) / 8)
}
