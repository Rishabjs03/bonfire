import { SnapshotBuffer } from './interpolation'

/** Per-frame state for each remote player, mutated by the network layer and read in useFrame. */
export interface RemoteRuntime {
  buffer: SnapshotBuffer
  sitting: boolean
  moving: boolean
  lastHeard: number
}

export const remotes = new Map<string, RemoteRuntime>()

export function getRemote(id: string): RemoteRuntime {
  let r = remotes.get(id)
  if (!r) {
    r = { buffer: new SnapshotBuffer(), sitting: false, moving: false, lastHeard: performance.now() }
    remotes.set(id, r)
  }
  return r
}
