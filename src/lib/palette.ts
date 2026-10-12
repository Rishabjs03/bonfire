export interface CharacterColors {
  body: string
  hat: string
}

/** Real outdoor-gear colours: parka body + scarf/mitten accent. */
export const PALETTE: readonly CharacterColors[] = [
  { body: '#7a1f1f', hat: '#d9cbb5' }, // deep red + cream
  { body: '#2f4a3a', hat: '#c79a4a' }, // forest green + mustard
  { body: '#1f2b45', hat: '#b8442f' }, // navy + rust
  { body: '#b8862f', hat: '#3a3a3a' }, // ochre + charcoal
  { body: '#3c3f44', hat: '#a33a3a' }, // charcoal + red
  { body: '#a24a1f', hat: '#2c3b4f' }, // burnt orange + slate
  { body: '#2e5c63', hat: '#e0d6c2' }, // teal + cream
  { body: '#4b2e45', hat: '#d1a35a' }, // plum + honey
]

