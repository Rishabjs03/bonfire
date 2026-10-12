/**
 * The people at the fire: Quaternius "Universal Base Characters" (CC0), dressed in code,
 * animated with Quaternius "Universal Animation Library" clips (CC0) on the same skeleton.
 */
export type Body = 'male' | 'female'

export interface Look {
  label: string
  body: Body
  skin: 'light' | 'dark'
  hair: string[]
  hairColor: string
  pants: string
}

export const LOOKS = {
  alex: { label: 'Alex', body: 'male', skin: 'light', hair: ['hair_simpleparted', 'hair_beard'], hairColor: '#4a3020', pants: '#2d3236' },
  sam: { label: 'Sam', body: 'male', skin: 'dark', hair: ['hair_buzzed'], hairColor: '#17110d', pants: '#3a3c2c' },
  maya: { label: 'Maya', body: 'female', skin: 'dark', hair: ['hair_buns'], hairColor: '#24160f', pants: '#272c38' },
  lena: { label: 'Lena', body: 'female', skin: 'light', hair: ['hair_long'], hairColor: '#8a6038', pants: '#3b3330' },
} as const satisfies Record<string, Look>

export type LookId = keyof typeof LOOKS
export const LOOK_IDS = Object.keys(LOOKS) as LookId[]
export const isLookId = (v: unknown): v is LookId => typeof v === 'string' && v in LOOKS

const BASE = '/assets/people/'
export const PEOPLE_URLS = {
  body: (b: Body) => `${BASE}${b}.glb`,
  skin: (l: Look) => `${BASE}skin_${l.body}_${l.skin}.jpg`,
  hair: (h: string) => `${BASE}${h}.glb`,
  anims: `${BASE}anims.glb`,
}

/** Clip names in anims.glb. */
export const CLIPS = {
  idle: 'Idle_Loop',
  talk: 'Idle_Talking_Loop',
  walk: 'Walk_Loop',
  sprint: 'Sprint_Loop',
  sitEnter: 'Sitting_Enter',
  sitIdle: 'Sitting_Idle_Loop',
  sitTalk: 'Sitting_Talking_Loop',
  sitExit: 'Sitting_Exit',
  wave: 'Interact',
  dance: 'Dance_Loop',
} as const

/** When seated, the hips sit this far behind the character's origin (metres). */
export const SIT_BACK_OFFSET = 0.25
