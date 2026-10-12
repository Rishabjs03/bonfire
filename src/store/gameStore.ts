import { Vector3 } from 'three'
import { create } from 'zustand'
import { PALETTE, type CharacterColors } from '../lib/palette'
import { randomName } from '../lib/names'
import { pick } from '../lib/random'
import { LOOK_IDS, type LookId } from '../player/people'

/** lobby: watching from the join screen · joined: by the fire · full: room cap reached */
export type Phase = 'lobby' | 'joined' | 'full'
/** Connection to the shared Realtime channel. offline = no Supabase config or it failed. */
export type NetStatus = 'connecting' | 'online' | 'offline'

export interface RemotePlayerInfo {
  id: string
  name: string
  colors: CharacterColors
  look: LookId
}

/** Reactive state that the UI cares about. Per-frame data lives in `localRuntime` / `remotes`. */
interface GameState {
  name: string
  colors: CharacterColors
  look: LookId
  sitting: boolean
  phase: Phase
  netStatus: NetStatus
  /** Players tracked in presence, including you once joined. */
  onlineCount: number
  players: Record<string, RemotePlayerInfo>
  chatOpen: boolean
  setChatOpen: (open: boolean) => void
  setName: (name: string) => void
  setColors: (colors: CharacterColors) => void
  setLook: (look: LookId) => void
  setSitting: (sitting: boolean) => void
}

export const useGameStore = create<GameState>((set) => ({
  name: randomName(),
  colors: pick(PALETTE),
  look: pick(LOOK_IDS),
  sitting: false,
  phase: 'lobby',
  netStatus: 'connecting',
  onlineCount: 0,
  players: {},
  chatOpen: false,
  setChatOpen: (chatOpen) => set({ chatOpen }),
  setName: (name) => set({ name }),
  setColors: (colors) => set({ colors }),
  setLook: (look) => set({ look }),
  setSitting: (sitting) => set({ sitting }),
}))

/**
 * Per-frame local player state. Mutated inside useFrame, so it lives outside React
 * to avoid re-renders and allocations.
 */
export const localRuntime = {
  position: new Vector3(),
  velocity: new Vector3(),
  rotY: 0,
  speed: 0,
  moving: false,
  sitting: false,
  cameraYaw: 0,
  /** Camera tilt (radians): negative looks up toward the peaks, positive looks down. */
  cameraPitch: 0,
  /** Camera distance multiplier (pinch / wheel). */
  cameraZoom: 1,
  spawned: false,
}
