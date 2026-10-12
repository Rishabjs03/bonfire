import type { NetStatus } from '../store/gameStore'

/** Who's at the fire, in the voice of the place. */
export function presenceLabel(status: NetStatus, count: number, joined: boolean) {
  if (status === 'offline') return joined ? 'Just you tonight' : 'Can’t reach the others right now. You’ll sit alone.'
  if (status === 'connecting') return 'Listening for voices…'
  if (count === 0) return 'No one’s here yet. Be the first.'
  return `${count} ${count === 1 ? 'person' : 'people'} by the fire`
}

/** Show the living ember dot when there are people. */
export const hasPeople = (status: NetStatus, count: number) => status === 'online' && count > 0
