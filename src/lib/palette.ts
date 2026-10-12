export interface CharacterColors {
  body: string
  hat: string
}

/** Curated cozy palette: knitwear and woodsmoke. */
export const PALETTE: readonly CharacterColors[] = [
  { body: '#c8553d', hat: '#f2e8cf' }, // rust + cream
  { body: '#e0a458', hat: '#7a4b3a' }, // mustard + chestnut
  { body: '#588b8b', hat: '#ffd5a8' }, // teal + apricot
  { body: '#8e6c8a', hat: '#f4c095' }, // plum + peach
  { body: '#5b7553', hat: '#e9c46a' }, // moss + honey
  { body: '#d4a5a5', hat: '#5c4d7d' }, // rose + violet
  { body: '#3d5a80', hat: '#ee6c4d' }, // denim + coral
  { body: '#a44a3f', hat: '#2f4858' }, // brick + slate
]

export const FACE_COLOR = '#f1d9c0'
