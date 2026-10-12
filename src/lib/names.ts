import { pick } from './random'

const ADJECTIVES = [
  'Sleepy', 'Lost', 'Quiet', 'Warm', 'Midnight', 'Gentle', 'Snowy', 'Drowsy', 'Wandering', 'Cozy',
  'Little', 'Mossy', 'Starry', 'Toasty', 'Frosty', 'Hushed', 'Wooly', 'Lantern', 'Alpine', 'Humble',
] as const

const NOUNS = [
  'Marmot', 'Hiker', 'Ibex', 'Fondue', 'Yodeler', 'Chamois', 'Owl', 'Edelweiss', 'Goatherd', 'Fox',
  'Pinecone', 'Cowbell', 'Raclette', 'Sled', 'Mitten', 'Lynx', 'Shepherd', 'Badger', 'Cocoa', 'Rösti',
] as const

export function randomName() {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`
}
