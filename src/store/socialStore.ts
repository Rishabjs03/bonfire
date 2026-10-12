import { create } from 'zustand'

export type EmoteKind = 'wave' | 'warm' | 'sleepy' | 'heart' | 'dance'
export const EMOTES: Record<EmoteKind, { key: string; icon: string; label: string; ms: number }> = {
  wave: { key: '1', icon: '👋', label: 'wave', ms: 2600 },
  warm: { key: '2', icon: '🙌', label: 'warm hands', ms: 2600 },
  sleepy: { key: '3', icon: '💤', label: 'sleepy', ms: 2600 },
  heart: { key: '4', icon: '❤️', label: 'heart', ms: 2600 },
  dance: { key: '5', icon: '🕺', label: 'dance', ms: 4200 },
}

/** What someone is doing with their hands. Lasts until they stop (no auto-expiry). */
export type ActKind = 'none' | 'roast'
export const ACT_KINDS: ActKind[] = ['none', 'roast']
export const isActKind = (v: unknown): v is ActKind => typeof v === 'string' && (ACT_KINDS as string[]).includes(v)

export const BUBBLE_MS = 5000
export const EMOTE_MS = 2600

export interface Timed<T> {
  value: T
  at: number
  /** Changes on every new message so repeated identical messages re-animate. */
  nonce: number
}

interface SocialState {
  bubbles: Record<string, Timed<string>>
  emotes: Record<string, Timed<EmoteKind>>
  /** Roasting a marshmallow, keyed by player id. Absent = hands free. */
  acts: Record<string, Timed<Exclude<ActKind, 'none'>>>
  showBubble: (id: string, text: string) => void
  showEmote: (id: string, kind: EmoteKind) => void
  /** `at` is the sender's start time (ms): everyone browns the same marshmallow at the same pace. */
  setAct: (id: string, kind: ActKind, at: number) => void
  clearAct: (id: string) => void
  expire: () => void
}

let nonce = 0

/** Ephemeral speech bubbles, emotes and activities, keyed by player id. No history is kept. */
export const useSocialStore = create<SocialState>((set, get) => ({
  bubbles: {},
  emotes: {},
  acts: {},
  showBubble: (id, text) => set((s) => ({ bubbles: { ...s.bubbles, [id]: { value: text, at: Date.now(), nonce: ++nonce } } })),
  showEmote: (id, kind) => set((s) => ({ emotes: { ...s.emotes, [id]: { value: kind, at: Date.now(), nonce: ++nonce } } })),
  setAct: (id, kind, at) => {
    const current = get().acts[id]
    if (kind === 'none') {
      if (current) get().clearAct(id)
      return
    }
    if (current && current.value === kind && current.at === at) return
    set((s) => ({ acts: { ...s.acts, [id]: { value: kind, at, nonce: ++nonce } } }))
  },
  clearAct: (id) =>
    set((s) => {
      if (!s.acts[id]) return s
      const acts = { ...s.acts }
      delete acts[id]
      return { acts }
    }),
  expire: () => {
    const now = Date.now()
    const { bubbles, emotes } = get()
    const liveBubbles = Object.fromEntries(Object.entries(bubbles).filter(([, b]) => now - b.at < BUBBLE_MS))
    const liveEmotes = Object.fromEntries(Object.entries(emotes).filter(([, e]) => now - e.at < EMOTES[e.value].ms))
    if (Object.keys(liveBubbles).length !== Object.keys(bubbles).length || Object.keys(liveEmotes).length !== Object.keys(emotes).length) {
      set({ bubbles: liveBubbles, emotes: liveEmotes })
    }
  },
}))

if (typeof window !== 'undefined') window.setInterval(() => useSocialStore.getState().expire(), 500)
