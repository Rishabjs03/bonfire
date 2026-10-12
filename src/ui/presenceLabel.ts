import type { NetStatus } from '../store/gameStore'

/** "🔥 3 people around the fire", in the voice of the place. */
export function presenceLabel(status: NetStatus, count: number, joined: boolean) {
  if (status === 'offline') return joined ? '🔥 just you tonight' : 'the others can’t reach the fire tonight — you’ll sit alone'
  if (status === 'connecting') return 'listening for voices…'
  if (count === 0) return 'no one’s here yet. be the first.'
  return `🔥 ${count} ${count === 1 ? 'person' : 'people'} around the fire`
}
