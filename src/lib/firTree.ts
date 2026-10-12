import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { trunkRadius } from './forest'
import { createRng } from './random'

/**
 * Twig cards in the fir_tree_01 atlas (Poly Haven, CC0). UVs are three.js style (v up);
 * every twig has its stem at the bottom edge, growing toward the top edge.
 */
const CARDS = [
  { u0: 0.303, u1: 0.646, v0: 0.219, v1: 0.6, aspect: 0.9 }, // large spray
  { u0: 0.631, u1: 0.959, v0: 0.164, v1: 0.553, aspect: 0.84 }, // large spray
  { u0: 0.648, u1: 0.941, v0: 0.625, v1: 0.961, aspect: 0.87 }, // medium
  { u0: 0.184, u1: 0.434, v0: 0.684, v1: 0.957, aspect: 0.91 }, // medium
  { u0: 0.488, u1: 0.635, v0: 0.594, v1: 0.744, aspect: 0.97 }, // small
]

export interface FirGeometry {
  bark: BufferGeometry
  foliage: BufferGeometry
}

class CardBuilder {
  positions: number[] = []
  normals: number[] = []
  uvs: number[] = []
  colors: number[] = []
  snow: number[] = []
  indices: number[] = []

  private corner = new Vector3()

  /**
   * Add a card whose stem sits at `base`, growing along `fwd`, spanning `side`.
   * `shadeNormal` is the (rounded) normal used for lighting.
   */
  add(
    base: Vector3,
    fwd: Vector3,
    side: Vector3,
    length: number,
    card: (typeof CARDS)[number],
    shadeNormal: Vector3,
    ao: number,
    snow: number,
    widthScale = 1.35,
  ) {
    const width = length * card.aspect * widthScale
    const start = this.positions.length / 3
    const corners: [number, number, number, number][] = [
      [-0.5, 0, card.u0, card.v0],
      [0.5, 0, card.u1, card.v0],
      [0.5, 1, card.u1, card.v1],
      [-0.5, 1, card.u0, card.v1],
    ]
    for (const [sx, fy, u, v] of corners) {
      this.corner
        .copy(base)
        .addScaledVector(side, sx * width)
        .addScaledVector(fwd, fy * length)
      this.positions.push(this.corner.x, this.corner.y, this.corner.z)
      this.normals.push(shadeNormal.x, shadeNormal.y, shadeNormal.z)
      this.uvs.push(u, v)
      // Tips are brighter than the inner crown.
      const tip = fy === 1 ? 1 : 0.7
      this.colors.push(ao * tip, ao * tip, ao * tip)
      this.snow.push(snow * (fy === 1 ? 1 : 0.55))
    }
    this.indices.push(start, start + 1, start + 2, start, start + 2, start + 3)
  }

  build() {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.normals, 3))
    g.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2))
    g.setAttribute('color', new Float32BufferAttribute(this.colors, 3))
    g.setAttribute('aSnow', new Float32BufferAttribute(this.snow, 1))
    g.setIndex(this.indices)
    g.computeBoundingSphere()
    return g
  }
}

function createTrunk(height: number, rand: () => number) {
  const baseR = trunkRadius(height)
  const trunk = new CylinderGeometry(0.025, baseR, height, 10, 10, true)
  trunk.translate(0, height / 2, 0)
  const pos = trunk.attributes.position
  const uv = trunk.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    // root flare
    const flare = 1 + 0.7 * Math.pow(Math.max(0, 1 - y / 0.7), 2)
    pos.setX(i, pos.getX(i) * flare)
    pos.setZ(i, pos.getZ(i) * flare)
    pos.setY(i, y - 0.15)
    uv.setXY(i, uv.getX(i) * 2, (uv.getY(i) * height) / 1.6)
  }

  // A few dead, bare branches on the lower trunk.
  const parts: BufferGeometry[] = [trunk]
  const crownBase = height * 0.22
  const dead = height > 5 ? 6 + Math.floor(rand() * 8) : 0
  for (let i = 0; i < dead; i++) {
    const y = 1.2 + rand() * (crownBase - 1)
    const len = 0.3 + rand() * 0.9
    const b = new CylinderGeometry(0.004, 0.022, len, 4, 1, true)
    b.translate(0, len / 2, 0)
    b.rotateZ(-Math.PI / 2 - (rand() * 0.5 - 0.15))
    b.rotateY(rand() * Math.PI * 2)
    b.translate(0, y, 0)
    parts.push(b)
  }
  const merged = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  merged.computeVertexNormals()
  return merged
}

/**
 * Build one procedural spruce/fir of roughly `height` metres.
 * `lowDetail` drops cross cards, inner fill and curtains, for trees deep in the fog.
 */
export function createFir(height: number, seed: number, lowDetail = false): FirGeometry {
  const rand = createRng(seed)
  const cards = new CardBuilder()
  const crownBase = height * (0.16 + rand() * 0.1)
  const crownRadius = 0.55 + height * 0.125
  const whorlGap = (0.24 + rand() * 0.06) * (lowDetail ? 1.7 : 1)

  const fwd = new Vector3()
  const side = new Vector3()
  const up = new Vector3()
  const pos = new Vector3()
  const base = new Vector3()
  const radial = new Vector3()
  const shade = new Vector3()

  let whorl = 0
  for (let y = crownBase; y < height - 0.35; y += whorlGap * (0.85 + rand() * 0.3)) {
    whorl++
    const t = (y - crownBase) / (height - crownBase) // 0 at crown base, 1 at top
    const branchLen = crownRadius * Math.pow(1 - t, 0.9) + 0.18
    const count = lowDetail ? 6 : 7 + Math.floor(rand() * 3)
    const offset = rand() * Math.PI * 2
    const trunkR = trunkRadius(height) * (1 - y / height)

    // Dense inner foliage hides the trunk, like a real spruce.
    if (t < 0.9 && !lowDetail) {
      for (let f = 0; f < 3; f++) {
        const a = rand() * Math.PI * 2
        const len = Math.min(branchLen * 0.6, 1.1) + 0.25
        const dir = new Vector3(Math.cos(a), (rand() - 0.6) * 0.8, Math.sin(a)).normalize()
        const sd = new Vector3(-Math.sin(a), rand() - 0.5, Math.cos(a)).normalize()
        const sh = new Vector3(Math.cos(a), 0.4, Math.sin(a)).normalize()
        cards.add(new Vector3(0, y, 0), dir, sd, len, CARDS[Math.floor(rand() * 4)], sh, 0.3, 0.05)
      }
    }

    for (let b = 0; b < count; b++) {
      const az = offset + (b / count) * Math.PI * 2 + (rand() - 0.5) * 0.5
      const dirX = Math.cos(az)
      const dirZ = Math.sin(az)
      // Upper branches reach up, lower ones droop.
      const pitch0 = 0.32 - (1 - t) * 0.5 + (rand() - 0.5) * 0.15
      const droop = 0.35 + (1 - t) * 0.55
      const segs = Math.max(1, Math.round(branchLen / 0.55))
      const segLen = branchLen / segs

      pos.set(dirX * trunkR, y, dirZ * trunkR)
      for (let s = 0; s < segs; s++) {
        const along = (s + 0.5) / segs
        const pitch = pitch0 - droop * Math.pow(along, 1.4)
        fwd.set(Math.cos(pitch) * dirX, Math.sin(pitch), Math.cos(pitch) * dirZ).normalize()
        side.set(-dirZ, 0, dirX)
        const roll = (rand() - 0.5) * 0.9 + (s % 2 ? 0.25 : -0.25)
        up.crossVectors(side, fwd).normalize()
        side.multiplyScalar(Math.cos(roll)).addScaledVector(up, Math.sin(roll)).normalize()

        const card = CARDS[segs > 1 && s === segs - 1 ? 2 + Math.floor(rand() * 2) : Math.floor(rand() * 2)]
        const cardLen = (segLen * 1.7 + 0.22) * (lowDetail ? 1.25 : 1)
        base.copy(pos).addScaledVector(fwd, -segLen * 0.15)

        radial.set(pos.x, 0, pos.z).normalize()
        const cardNormal = up.crossVectors(side, fwd).normalize()
        if (cardNormal.y < 0) cardNormal.negate()
        shade.copy(radial).multiplyScalar(0.75).addScaledVector(cardNormal, 0.6)
        shade.y += 0.25
        shade.normalize()

        const ao = (0.32 + 0.68 * Math.pow((s + 1) / segs, 0.6)) * (0.65 + 0.35 * t)
        const snow = Math.pow(Math.max(0, cardNormal.y), 1.5) * (0.4 + 0.6 * along) * (0.55 + rand() * 0.45)
        cards.add(base, fwd, side, cardLen, card, shade, ao, snow)
        // A second, steeply rolled card makes each spray read as a volume, not a plane.
        if (!lowDetail && rand() < 0.7) {
          const roll2 = roll > 0 ? -0.7 : 0.7
          const side2 = new Vector3(-dirZ, 0, dirX)
          const up2 = new Vector3().crossVectors(side2, fwd).normalize()
          side2.multiplyScalar(Math.cos(roll2)).addScaledVector(up2, Math.sin(roll2)).normalize()
          cards.add(base, fwd, side2, cardLen * 0.85, CARDS[Math.floor(rand() * 4)], shade, ao * 0.85, snow * 0.4)
        }

        // Norway-spruce "curtains": small sprays hanging under lower branches.
        if (!lowDetail && t < 0.65 && s > 0 && rand() < 0.55) {
          const hang = new Vector3(dirX * 0.25, -1, dirZ * 0.25).normalize()
          const hangSide = new Vector3(-dirZ, 0, dirX)
          const hangBase = pos.clone().addScaledVector(fwd, segLen * 0.3)
          const small = CARDS[2 + Math.floor(rand() * 3)]
          cards.add(hangBase, hang, hangSide, segLen * 0.9, small, radial, ao * 0.85, 0)
        }

        pos.addScaledVector(fwd, segLen)
      }
    }
  }

  // Leader shoot: two crossed upright cards at the top.
  const top = new Vector3(0, height - 0.6, 0)
  const vertical = new Vector3(0, 1, 0)
  for (let i = 0; i < 2; i++) {
    const a = (i * Math.PI) / 2
    cards.add(
      top,
      vertical,
      new Vector3(Math.cos(a), 0, Math.sin(a)),
      0.9,
      CARDS[3],
      new Vector3(0, 1, 0),
      1,
      0.3,
    )
  }

  return { bark: createTrunk(height, rand), foliage: cards.build() }
}
