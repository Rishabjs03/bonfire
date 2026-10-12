import { useEffect } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { NET } from '../config'
import type { CharacterColors } from '../lib/palette'
import { spawnLocalPlayer } from '../player/spawn'
import { localRuntime, useGameStore, type RemotePlayerInfo } from '../store/gameStore'
import { cleanName, encodeMove, parseMove, parsePresence, type PresenceMeta } from './protocol'
import { getRemote, remotes } from './remotes'
import { supabase } from './supabase'

const SEND_TICK = 50 // ms
const STALE_CHECK = 2000 // ms

/** This tab's identity for the session. */
export const myId = crypto.randomUUID()

if (import.meta.env.DEV) Object.assign(window, { __net: { myId, remotes, localRuntime, store: useGameStore } })

let channel: RealtimeChannel | null = null
let meta: PresenceMeta | null = null
let lastSend = 0
let lastSent = { x: 0, z: 0, rotY: 0, sitting: false }
let wasMoving = false

const store = useGameStore

function presenceMetas(): PresenceMeta[] {
  if (!channel) return []
  const state = channel.presenceState()
  const metas: PresenceMeta[] = []
  for (const entries of Object.values(state)) {
    const parsed = parsePresence(entries[0])
    if (parsed) metas.push(parsed)
  }
  return metas.sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
}

function handleSync() {
  const metas = presenceMetas()
  const { phase } = store.getState()

  // Room cap: whoever joined last steps back.
  if (phase === 'joined' && metas.findIndex((m) => m.id === myId) >= NET.maxPlayers) {
    void channel?.untrack()
    meta = null
    store.setState({ phase: 'full' })
    return
  }

  const players: Record<string, RemotePlayerInfo> = {}
  const now = performance.now()
  for (const m of metas) {
    if (m.id === myId) continue
    players[m.id] = { id: m.id, name: m.name, colors: m.colors }
    const isNew = !remotes.has(m.id)
    const r = getRemote(m.id)
    const latest = r.buffer.latest
    // Presence carries the resting pose (sent when someone stops or sits down).
    const moved = !latest || Math.hypot(latest.x - m.x, latest.z - m.z) > 0.05 || Math.abs(latest.rotY - m.rotY) > 0.05
    if (isNew) r.buffer.reset({ t: now, x: m.x, z: m.z, rotY: m.rotY, vx: 0, vz: 0 })
    else if (moved) r.buffer.push({ t: now, x: m.x, z: m.z, rotY: m.rotY, vx: 0, vz: 0 })
    r.sitting = m.sitting
    r.moving = false
    r.lastHeard = now
  }
  for (const id of remotes.keys()) if (!players[id]) remotes.delete(id)

  // Avoid re-rendering the player list unless membership or a profile changed.
  const prev = store.getState().players
  const same =
    Object.keys(prev).length === Object.keys(players).length &&
    Object.values(players).every(
      (p) => prev[p.id]?.name === p.name && prev[p.id]?.colors.body === p.colors.body && prev[p.id]?.colors.hat === p.colors.hat,
    )
  store.setState({ onlineCount: metas.length, ...(same ? {} : { players }) })
}

function handleMove(payload: unknown) {
  const m = parseMove(payload)
  if (!m || m.id === myId) return
  const r = getRemote(m.id)
  const now = performance.now()
  r.buffer.push({ t: now, x: m.x, z: m.z, rotY: m.rotY, vx: m.vx, vz: m.vz })
  r.moving = m.moving
  r.sitting = m.sitting
  r.lastHeard = now
}

function restingMeta(): PresenceMeta | null {
  if (!meta) return null
  const rt = localRuntime
  return { ...meta, x: rt.position.x, z: rt.position.z, rotY: rt.rotY, sitting: rt.sitting }
}

/**
 * Called every 50 ms. While walking, broadcast at an adaptive rate that keeps the whole
 * room under the Realtime message budget; on coming to rest (or sitting down/up), publish
 * the resting pose via presence instead, so idle players cost nothing and late joiners
 * still see where everyone is.
 */
function sendTick() {
  if (!channel || !meta || store.getState().phase !== 'joined') return
  const rt = localRuntime
  const now = performance.now()
  const others = store.getState().onlineCount - 1

  const sittingChanged = rt.sitting !== lastSent.sitting
  if (!rt.moving && (wasMoving || sittingChanged)) {
    wasMoving = false
    lastSent = { x: rt.position.x, z: rt.position.z, rotY: rt.rotY, sitting: rt.sitting }
    meta = restingMeta()
    if (meta) void channel.track(meta)
    return
  }
  if (!rt.moving || others < 1) {
    wasMoving = wasMoving || rt.moving
    return
  }
  wasMoving = true

  // Every broadcast is delivered to each other player: rate × movers × listeners ≤ budget.
  let movers = 1
  for (const r of remotes.values()) if (r.moving && now - r.lastHeard < 2000) movers++
  const hz = Math.min(NET.maxSendHz, Math.max(NET.minSendHz, NET.messageBudget / (movers * (others + 1))))
  if (now - lastSend < 1000 / hz) return

  const changed =
    Math.hypot(rt.position.x - lastSent.x, rt.position.z - lastSent.z) > 0.02 ||
    Math.abs(rt.rotY - lastSent.rotY) > 0.03 ||
    sittingChanged
  if (!changed) return

  lastSend = now
  lastSent = { x: rt.position.x, z: rt.position.z, rotY: rt.rotY, sitting: rt.sitting }
  void channel.send({
    type: 'broadcast',
    event: 'move',
    payload: encodeMove({
      id: myId,
      x: rt.position.x,
      z: rt.position.z,
      rotY: rt.rotY,
      vx: rt.velocity.x,
      vz: rt.velocity.z,
      sitting: rt.sitting,
      moving: true,
    }),
  })
}

function checkStale() {
  const now = performance.now()
  for (const r of remotes.values()) {
    // A walker who went silent (lost connection, background tab) is frozen in place;
    // presence removes them entirely once their socket drops.
    if (r.moving && now - r.lastHeard > NET.staleAfter) r.moving = false
  }
}

/** Step up to the fire. Works offline too (you'll just be alone). */
export async function joinFire(name: string, colors: CharacterColors) {
  const cleaned = cleanName(name) || 'Wanderer'
  store.setState({ name: cleaned, colors })
  const { netStatus, onlineCount } = store.getState()
  if (channel && netStatus === 'online' && onlineCount >= NET.maxPlayers) {
    store.setState({ phase: 'full' })
    return
  }
  spawnLocalPlayer()
  lastSent = { x: localRuntime.position.x, z: localRuntime.position.z, rotY: localRuntime.rotY, sitting: false }
  meta = {
    id: myId,
    name: cleaned,
    colors,
    joinedAt: Date.now(),
    x: localRuntime.position.x,
    z: localRuntime.position.z,
    rotY: localRuntime.rotY,
    sitting: false,
  }
  store.setState({ phase: 'joined' })
  if (channel && netStatus === 'online') await channel.track(meta)
}

/** Connect to the shared channel (as a watcher until `joinFire`). Mount once. */
export function useMultiplayer() {
  useEffect(() => {
    if (!supabase) {
      store.setState({ netStatus: 'offline' })
      return
    }
    const client = supabase
    const ch = client.channel(NET.channel, {
      config: { presence: { key: myId }, broadcast: { self: false, ack: false } },
    })
    channel = ch
    ch.on('presence', { event: 'sync' }, handleSync)
    ch.on('broadcast', { event: 'move' }, ({ payload }) => handleMove(payload))
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        store.setState({ netStatus: 'online' })
        // After a reconnect, presence has to be re-announced.
        const resting = restingMeta()
        if (resting && store.getState().phase === 'joined') void ch.track(resting)
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        store.setState({ netStatus: store.getState().netStatus === 'online' ? 'connecting' : 'offline' })
      }
    })

    const sendTimer = window.setInterval(sendTick, SEND_TICK)
    const staleTimer = window.setInterval(checkStale, STALE_CHECK)
    const leave = () => {
      void ch.untrack()
    }
    window.addEventListener('pagehide', leave)

    return () => {
      window.clearInterval(sendTimer)
      window.clearInterval(staleTimer)
      window.removeEventListener('pagehide', leave)
      void client.removeChannel(ch)
      channel = null
      remotes.clear()
    }
  }, [])
}
