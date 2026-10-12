import { create } from 'zustand'

/** What's playing on *your* radio. Music is local: nobody else hears it. */
export interface NowPlaying {
  kind: 'station' | 'spotify' | 'youtube'
  title: string
  subtitle?: string
  /** Stream URL (stations) or embed URL (Spotify / YouTube). */
  url: string
}

interface RadioState {
  /** Standing close enough to the radio to use it. */
  near: boolean
  open: boolean
  /** Spotify / YouTube player card shown (it keeps playing when collapsed). */
  playerExpanded: boolean
  playing: NowPlaying | null
  volume: number
  error: string | null
  setOpen: (open: boolean) => void
  setPlayerExpanded: (expanded: boolean) => void
  play: (item: NowPlaying) => void
  stop: () => void
  setVolume: (v: number) => void
}

const VOLUME_KEY = 'bonfire-radio-volume'
const initialVolume = (() => {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY))
    return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.7
  } catch {
    return 0.7
  }
})()

export const useRadioStore = create<RadioState>((set) => ({
  near: false,
  open: false,
  playerExpanded: false,
  playing: null,
  volume: initialVolume,
  error: null,
  setOpen: (open) => set({ open }),
  // Embedded players need a click on their own play button, so show them right away.
  play: (playing) => set({ playing, playerExpanded: playing.kind !== 'station', open: playing.kind === 'station' }),
  setPlayerExpanded: (playerExpanded) => set({ playerExpanded }),
  stop: () => set({ playing: null, error: null, playerExpanded: false }),
  setVolume: (volume) => {
    try {
      localStorage.setItem(VOLUME_KEY, String(volume))
    } catch {
      // not persisted
    }
    set({ volume })
  },
}))
