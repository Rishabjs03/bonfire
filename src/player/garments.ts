import { BufferAttribute, Vector3, type BufferGeometry } from 'three'

/**
 * Dress a base body by reshaping its bind-pose mesh into clothes. Clothed areas (from the
 * per-vertex garment weights) are Laplacian-smoothed, which irons out muscles and curves
 * the way a thick down jacket or loose trousers would, then lofted outward. Faces, hands
 * and feet keep their shape, and the transitions follow the skin weights, so the result
 * still animates with the skeleton.
 */
const ITERATIONS = 60
const LAMBDA = 0.55
const JACKET_LOFT = 0.034
const TROUSER_LOFT = 0.016

export function dressBody(geometry: BufferGeometry) {
  if (geometry.userData.dressed) return
  geometry.userData.dressed = true
  const pos = geometry.getAttribute('position')
  const cloth = geometry.getAttribute('aCloth')
  const index = geometry.getIndex()
  if (!index || !cloth) return

  // Weld vertices split along UV seams so smoothing doesn't tear the mesh apart.
  const weldId = new Int32Array(pos.count)
  const ids = new Map<string, number>()
  for (let v = 0; v < pos.count; v++) {
    const k = `${Math.round(pos.getX(v) * 1e4)}_${Math.round(pos.getY(v) * 1e4)}_${Math.round(pos.getZ(v) * 1e4)}`
    let id = ids.get(k)
    if (id === undefined) {
      id = ids.size
      ids.set(k, id)
    }
    weldId[v] = id
  }
  const n = ids.size
  const p = new Float32Array(n * 3)
  const strength = new Float32Array(n)
  const jacket = new Float32Array(n)
  const trousers = new Float32Array(n)
  for (let v = 0; v < pos.count; v++) {
    const w = weldId[v]
    p[w * 3] = pos.getX(v)
    p[w * 3 + 1] = pos.getY(v)
    p[w * 3 + 2] = pos.getZ(v)
    const j = Math.min(1, Math.max(0, (cloth.getX(v) - 0.3) / 0.4))
    const t = Math.min(1, Math.max(0, (cloth.getY(v) - 0.3) / 0.4))
    jacket[w] = j
    trousers[w] = t
    strength[w] = Math.min(1, j + t)
  }

  // neighbours from triangles
  const neighbours: Set<number>[] = Array.from({ length: n }, () => new Set<number>())
  for (let i = 0; i < index.count; i += 3) {
    const a = weldId[index.getX(i)]
    const b = weldId[index.getX(i + 1)]
    const c = weldId[index.getX(i + 2)]
    neighbours[a].add(b).add(c)
    neighbours[b].add(a).add(c)
    neighbours[c].add(a).add(b)
  }
  const adj = neighbours.map((s) => Int32Array.from(s))

  const next = new Float32Array(p.length)
  for (let it = 0; it < ITERATIONS; it++) {
    for (let v = 0; v < n; v++) {
      const s = strength[v] * LAMBDA
      const nb = adj[v]
      if (s === 0 || nb.length === 0) {
        next[v * 3] = p[v * 3]
        next[v * 3 + 1] = p[v * 3 + 1]
        next[v * 3 + 2] = p[v * 3 + 2]
        continue
      }
      let ax = 0
      let ay = 0
      let az = 0
      for (let k = 0; k < nb.length; k++) {
        ax += p[nb[k] * 3]
        ay += p[nb[k] * 3 + 1]
        az += p[nb[k] * 3 + 2]
      }
      const inv = 1 / nb.length
      next[v * 3] = p[v * 3] + s * (ax * inv - p[v * 3])
      next[v * 3 + 1] = p[v * 3 + 1] + s * (ay * inv - p[v * 3 + 1])
      next[v * 3 + 2] = p[v * 3 + 2] + s * (az * inv - p[v * 3 + 2])
    }
    p.set(next)
  }

  // loft the garments outward along the smoothed surface normals
  const normals = weldedNormals(p, adj.length, index, weldId)
  for (let v = 0; v < n; v++) {
    const loft = jacket[v] * JACKET_LOFT + trousers[v] * TROUSER_LOFT
    p[v * 3] += normals[v * 3] * loft
    p[v * 3 + 1] += normals[v * 3 + 1] * loft
    p[v * 3 + 2] += normals[v * 3 + 2] * loft
  }

  // write back per vertex (glTF data may be interleaved) and refresh normals
  for (let v = 0; v < pos.count; v++) {
    const w = weldId[v]
    pos.setXYZ(v, p[w * 3], p[w * 3 + 1], p[w * 3 + 2])
  }
  pos.needsUpdate = true
  const finalNormals = weldedNormals(p, n, index, weldId)
  const out = new Float32Array(pos.count * 3)
  for (let v = 0; v < pos.count; v++) out.set(finalNormals.subarray(weldId[v] * 3, weldId[v] * 3 + 3), v * 3)
  geometry.setAttribute('normal', new BufferAttribute(out, 3))
  geometry.deleteAttribute('tangent') // stale after reshaping; three derives tangents per pixel
  geometry.computeBoundingSphere()
}

/** Area-weighted normals per welded vertex. */
function weldedNormals(p: Float32Array, n: number, index: NonNullable<BufferGeometry['index']>, weldId: Int32Array) {
  const out = new Float32Array(n * 3)
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  for (let i = 0; i < index.count; i += 3) {
    const ia = weldId[index.getX(i)]
    const ib = weldId[index.getX(i + 1)]
    const ic = weldId[index.getX(i + 2)]
    a.fromArray(p, ia * 3)
    b.fromArray(p, ib * 3).sub(a)
    c.fromArray(p, ic * 3).sub(a)
    b.cross(c)
    for (const v of [ia, ib, ic]) {
      out[v * 3] += b.x
      out[v * 3 + 1] += b.y
      out[v * 3 + 2] += b.z
    }
  }
  for (let v = 0; v < n; v++) {
    const l = Math.hypot(out[v * 3], out[v * 3 + 1], out[v * 3 + 2]) || 1
    out[v * 3] /= l
    out[v * 3 + 1] /= l
    out[v * 3 + 2] /= l
  }
  return out
}
