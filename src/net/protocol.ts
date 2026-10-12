import { WORLD } from '../config'
import { PALETTE, type CharacterColors } from '../lib/palette'
import { filterProfanity } from '../lib/profanity'
import { EMOTES, type EmoteKind } from '../store/socialStore'

/** Presence metadata: who someone is, plus where they last came to rest. */
export interface PresenceMeta {
  id: string
  name: string
  colors: CharacterColors
  joinedAt: number
  x: number
  z: number
  rotY: number
  sitting: boolean
}

/** Broadcast while walking. */
export interface MoveMessage {
  id: string
  x: number
  z: number
  rotY: number
  vx: number
  vz: number
  sitting: boolean
  moving: boolean
}

export const MAX_NAME_LENGTH = 24
export const MAX_CHAT_LENGTH = 80

export interface ChatMessage {
  id: string
  text: string
}

export interface EmoteMessage {
  id: string
  kind: EmoteKind
}

const round = (n: number) => Math.round(n * 100) / 100
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const num = (v: unknown, limit: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(-limit, Math.min(limit, v)) : null
const COLOR = /^#[0-9a-f]{6}$/i

export function cleanName(name: string) {
  return filterProfanity(name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH))
}

export function cleanChat(text: string) {
  // strip control characters, collapse whitespace, clamp, filter
  // eslint-disable-next-line no-control-regex -- removing control characters is the point
  const printable = text.replace(/[\u0000-\u001f\u007f]/g, '')
  return filterProfanity(printable.replace(/\s+/g, ' ').trim().slice(0, MAX_CHAT_LENGTH))
}

export function encodeMove(m: MoveMessage): MoveMessage {
  return { ...m, x: round(m.x), z: round(m.z), rotY: round(m.rotY), vx: round(m.vx), vz: round(m.vz) }
}

// Everything below parses data from other clients: treat it as untrusted.

export function parseMove(p: unknown): MoveMessage | null {
  if (!isObject(p) || typeof p.id !== 'string' || p.id.length > 64) return null
  const bound = WORLD.radius + 10
  const x = num(p.x, bound)
  const z = num(p.z, bound)
  const rotY = num(p.rotY, 100)
  const vx = num(p.vx, 10)
  const vz = num(p.vz, 10)
  if (x === null || z === null || rotY === null || vx === null || vz === null) return null
  return { id: p.id, x, z, rotY, vx, vz, sitting: p.sitting === true, moving: p.moving === true }
}

export function parsePresence(p: unknown): PresenceMeta | null {
  if (!isObject(p) || typeof p.id !== 'string' || p.id.length > 64) return null
  const colors = isObject(p.colors) ? p.colors : {}
  const body = typeof colors.body === 'string' && COLOR.test(colors.body) ? colors.body : PALETTE[0].body
  const hat = typeof colors.hat === 'string' && COLOR.test(colors.hat) ? colors.hat : PALETTE[0].hat
  const bound = WORLD.radius + 10
  return {
    id: p.id,
    name: typeof p.name === 'string' && cleanName(p.name) ? cleanName(p.name) : 'Wanderer',
    colors: { body, hat },
    joinedAt: typeof p.joinedAt === 'number' && Number.isFinite(p.joinedAt) ? p.joinedAt : Date.now(),
    x: num(p.x, bound) ?? 0,
    z: num(p.z, bound) ?? 0,
    rotY: num(p.rotY, 100) ?? 0,
    sitting: p.sitting === true,
  }
}

export function parseChat(p: unknown): ChatMessage | null {
  if (!isObject(p) || typeof p.id !== 'string' || p.id.length > 64 || typeof p.text !== 'string') return null
  const text = cleanChat(p.text)
  return text ? { id: p.id, text } : null
}

export function parseEmote(p: unknown): EmoteMessage | null {
  if (!isObject(p) || typeof p.id !== 'string' || p.id.length > 64) return null
  return typeof p.kind === 'string' && p.kind in EMOTES ? { id: p.id, kind: p.kind as EmoteKind } : null
}
