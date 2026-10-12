/**
 * Small, dependency-free profanity filter. Matches whole words (so "class" or
 * "Scunthorpe" are safe), sees through simple leetspeak and stretched letters, and
 * replaces matches with ✦✦✦.
 */
const ROOTS = [
  'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'bullshit', 'cunt', 'bitch', 'bastard', 'asshole',
  'arsehole', 'dick', 'dickhead', 'cock', 'pussy', 'slut', 'whore', 'twat', 'wanker', 'prick', 'piss',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'spic', 'chink', 'kike', 'tranny', 'dyke', 'rape', 'rapist',
]
const SUFFIXES = ['', 's', 'es', 'ed', 'er', 'ers', 'ing', 'y']
const BAD = new Set(ROOTS.flatMap((r) => SUFFIXES.map((s) => r + s)))

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', $: 's', '7': 't', '+': 't' }

function normalize(word: string) {
  return word
    .toLowerCase()
    .replace(/[0134@57$!+]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1{2,}/g, '$1$1') // "fuuuuck" → "fuuck"
}

function isBad(word: string) {
  const n = normalize(word)
  if (!n) return false
  return BAD.has(n) || BAD.has(n.replace(/(.)\1+/g, '$1'))
}

export function filterProfanity(text: string) {
  return text.replace(/[\p{L}\p{N}@$!+]+/gu, (word) => (isBad(word) ? '✦✦✦' : word))
}
