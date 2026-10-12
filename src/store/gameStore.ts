import { Vector3 } from 'three'
import { create } from 'zustand'
import { PALETTE, type CharacterColors } from '../lib/palette'
import { randomName } from '../lib/names'
import { pick } from '../lib/random'

/** Reactive state that the UI cares about. */
interface GameState {
  name: string
  colors: CharacterColors
  sitting: boolean
  setName: (name: string) => void
  setColors: (colors: CharacterColors) => void
  setSitting: (sitting: boolean) => void
}

export const useGameStore = create<GameState>((set) => ({
  name: randomName(),
  colors: pick(PALETTE),
  sitting: false,
  setName: (name) => set({ name }),
  setColors: (colors) => set({ colors }),
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
  spawned: false,
}
