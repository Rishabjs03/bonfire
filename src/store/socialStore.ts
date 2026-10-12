import { create } from 'zustand'

export type EmoteKind = 'wave' | 'warm' | 'sleepy' | 'heart'
export const EMOTES: Record<EmoteKind, { key: string; icon: string; label: string }> = {
  wave: { key: '1', icon: '👋', label: 'wave' },
  warm: { key: '2', icon: '🙌', label: 'warm hands' },
  sleepy: { key: '3', icon: '💤', label: 'sleepy' },
  heart: { key: '4', icon: '❤️', label: 'heart' },
}

export const BUBBLE_MS = 5000
export const EMOTE_MS = 2600

interface Timed<T> {
  value: T
  at: number
  /** Changes on every new message so repeated identical messages re-animate. */
  nonce: number
}

interface SocialState {
  bubbles: Record<string, Timed<string>>
  emotes: Record<string, Timed<EmoteKind>>
  showBubble: (id: string, text: string) => void
  showEmote: (id: string, kind: EmoteKind) => void
  expire: () => void
}

let nonce = 0

/** Ephemeral speech bubbles and emotes, keyed by player id. No history is kept. */
export const useSocialStore = create<SocialState>((set, get) => ({
  bubbles: {},
  emotes: {},
  showBubble: (id, text) => set((s) => ({ bubbles: { ...s.bubbles, [id]: { value: text, at: Date.now(), nonce: ++nonce } } })),
  showEmote: (id, kind) => set((s) => ({ emotes: { ...s.emotes, [id]: { value: kind, at: Date.now(), nonce: ++nonce } } })),
  expire: () => {
    const now = Date.now()
    const { bubbles, emotes } = get()
    const liveBubbles = Object.fromEntries(Object.entries(bubbles).filter(([, b]) => now - b.at < BUBBLE_MS))
    const liveEmotes = Object.fromEntries(Object.entries(emotes).filter(([, e]) => now - e.at < EMOTE_MS))
    if (Object.keys(liveBubbles).length !== Object.keys(bubbles).length || Object.keys(liveEmotes).length !== Object.keys(emotes).length) {
      set({ bubbles: liveBubbles, emotes: liveEmotes })
    }
  },
}))

if (typeof window !== 'undefined') window.setInterval(() => useSocialStore.getState().expire(), 500)
