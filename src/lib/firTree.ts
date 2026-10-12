import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Species } from './forest'
import { trunkRadius } from './forest'
import { createRng } from './random'

/** A branch card in a twig atlas. UVs are three.js style (v up), stem at the bottom edge. */
interface Card {
  u0: number
  u1: number
  v0: number
  v1: number
  aspect: number
}

/** fir_tree_01 twig atlas (Poly Haven, CC0): soft sprays, used for larch. */
const SPRAYS: Card[] = [
  { u0: 0.303, u1: 0.646, v0: 0.219, v1: 0.6, aspect: 0.9 },
  { u0: 0.631, u1: 0.959, v0: 0.164, v1: 0.553, aspect: 0.84 },
  { u0: 0.648, u1: 0.941, v0: 0.625, v1: 0.961, aspect: 0.87 },
  { u0: 0.184, u1: 0.434, v0: 0.684, v1: 0.957, aspect: 0.91 },
  { u0: 0.488, u1: 0.635, v0: 0.594, v1: 0.744, aspect: 0.97 },
]

/** pine_tree_01 twig (cropped atlas): long needle tufts, used for Swiss stone pine. */
const TUFT: Card = { u0: 0.16, u1: 0.863, v0: 0.128, v1: 0.928, aspect: 0.44 }

interface SpeciesShape {
  crownBase: number // fraction of height without foliage
  radius: (height: number) => number
  /** Branch length along the crown, t = 0 at crown base .. 1 at top. */
  profile: (t: number) => number
  whorlGap: number
  branches: number
  segment: number // metres per card along a branch
  cardScale: number
  width: number // card width multiplier
  droop: number
  hanging: number // chance of hanging branchlets
  cross: number // chance of a second, rolled card
  inner: number // filler cards per whorl near the trunk
  tint: [number, number, number] // multiplies the twig texture
}

const SHAPES: Record<Species, SpeciesShape> = {
  // European larch: narrow cone, airy, branchlets hanging from near-horizontal limbs.
  larch: {
    crownBase: 0.2,
    radius: (h) => 0.5 + h * 0.105,
    profile: (t) => Math.pow(1 - t, 0.95),
    whorlGap: 0.36,
    branches: 6,
    segment: 0.6,
    cardScale: 1.55,
    width: 1.15,
    droop: 0.75,
    hanging: 0.7,
    cross: 0.35,
    inner: 1,
    tint: [1.02, 1.12, 0.7],
  },
  // Swiss stone pine (Arve): dense, dark, broad rounded crown down low.
  pine: {
    crownBase: 0.1,
    radius: (h) => 0.7 + h * 0.15,
    profile: (t) => Math.sqrt(Math.max(0, 1 - Math.pow(t, 1.7))) * (0.75 + 0.25 * (1 - t)),
    whorlGap: 0.28,
    branches: 7,
    segment: 0.46,
    cardScale: 1.9,
    width: 2.6,
    droop: 0.25,
    hanging: 0,
    cross: 0.55,
    inner: 2,
    tint: [0.78, 0.92, 0.82],
  },
}

export interface TreeGeometry {
  bark: BufferGeometry
  foliage: BufferGeometry
}

class CardBuilder {
  positions: number[] = []
  normals: number[] = []
  uvs: number[] = []
  colors: number[] = []
  indices: number[] = []
  private corner = new Vector3()
  private tint: [number, number, number]

  constructor(tint: [number, number, number]) {
    this.tint = tint
  }

  add(base: Vector3, fwd: Vector3, side: Vector3, length: number, card: Card, shade: Vector3, ao: number, widthScale: number) {
    const width = length * card.aspect * widthScale
    const start = this.positions.length / 3
    const corners: [number, number, number, number][] = [
      [-0.5, 0, card.u0, card.v0],
      [0.5, 0, card.u1, card.v0],
      [0.5, 1, card.u1, card.v1],
      [-0.5, 1, card.u0, card.v1],
    ]
    for (const [sx, fy, u, v] of corners) {
      this.corner.copy(base).addScaledVector(side, sx * width).addScaledVector(fwd, fy * length)
      this.positions.push(this.corner.x, this.corner.y, this.corner.z)
      this.normals.push(shade.x, shade.y, shade.z)
      this.uvs.push(u, v)
      const tip = fy === 1 ? 1 : 0.72 // tips catch more light than the inner crown
      this.colors.push(ao * tip * this.tint[0], ao * tip * this.tint[1], ao * tip * this.tint[2])
    }
    this.indices.push(start, start + 1, start + 2, start, start + 2, start + 3)
  }

  build() {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.normals, 3))
    g.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2))
    g.setAttribute('color', new Float32BufferAttribute(this.colors, 3))
    g.setIndex(this.indices)
    g.computeBoundingSphere()
    return g
  }
}

function createTrunk(height: number, rand: () => number, crownBase: number) {
  const baseR = trunkRadius(height)
  const trunk = new CylinderGeometry(0.02, baseR, height, 10, 10, true)
  trunk.translate(0, height / 2, 0)
  const pos = trunk.attributes.position
  const uv = trunk.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const flare = 1 + 0.6 * Math.pow(Math.max(0, 1 - y / 0.7), 2) // root flare
    // a gentle lean and wander, so trunks aren't laser-straight
    const lean = Math.sin(y * 0.35 + rand() * 0.001) * 0.04 * (y / height)
    pos.setX(i, pos.getX(i) * flare + lean)
    pos.setZ(i, pos.getZ(i) * flare)
    pos.setY(i, y - 0.15)
    uv.setXY(i, uv.getX(i) * 2, (uv.getY(i) * height) / 1.6)
  }
  const parts: BufferGeometry[] = [trunk]
  // dead lower branches
  const dead = height > 5 ? 5 + Math.floor(rand() * 8) : 0
  for (let i = 0; i < dead; i++) {
    const y = 1.0 + rand() * Math.max(0.5, height * crownBase - 1)
    const len = 0.3 + rand() * 0.8
    const b = new CylinderGeometry(0.004, 0.02, len, 4, 1, true)
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

/** Build one procedural conifer of roughly `height` metres. */
export function createTree(species: Species, height: number, seed: number, lowDetail = false): TreeGeometry {
  const s = SHAPES[species]
  const rand = createRng(seed)
  const cards = new CardBuilder(s.tint)
  const crownBase = height * (s.crownBase + rand() * 0.08)
  const crownRadius = s.radius(height)
  const whorlGap = s.whorlGap * (0.9 + rand() * 0.2) * (lowDetail ? 1.8 : 1)
  const pick = (): Card => (species === 'pine' ? TUFT : SPRAYS[Math.floor(rand() * 4)])

  const fwd = new Vector3()
  const side = new Vector3()
  const up = new Vector3()
  const pos = new Vector3()
  const base = new Vector3()
  const radial = new Vector3()
  const shade = new Vector3()

  for (let y = crownBase; y < height - 0.3; y += whorlGap * (0.85 + rand() * 0.3)) {
    const t = (y - crownBase) / (height - crownBase)
    const branchLen = crownRadius * s.profile(t) + 0.2
    const count = lowDetail ? Math.max(4, s.branches - 3) : s.branches + Math.floor(rand() * 3)
    const offset = rand() * Math.PI * 2
    const trunkR = trunkRadius(height) * (1 - y / height)

    if (!lowDetail) {
      for (let f = 0; f < s.inner; f++) {
        const a = rand() * Math.PI * 2
        const len = Math.min(branchLen * 0.6, 1.1) + 0.25
        const dir = new Vector3(Math.cos(a), (rand() - 0.5) * 0.9, Math.sin(a)).normalize()
        const sd = new Vector3(-Math.sin(a), rand() - 0.5, Math.cos(a)).normalize()
        const sh = new Vector3(Math.cos(a), 0.4, Math.sin(a)).normalize()
        cards.add(new Vector3(0, y, 0), dir, sd, len, pick(), sh, 0.3, s.width)
      }
    }

    for (let b = 0; b < count; b++) {
      const az = offset + (b / count) * Math.PI * 2 + (rand() - 0.5) * 0.6
      const dirX = Math.cos(az)
      const dirZ = Math.sin(az)
      const pitch0 = (species === 'pine' ? 0.45 : 0.15) - (1 - t) * 0.35 + (rand() - 0.5) * 0.2
      const droop = s.droop * (0.5 + (1 - t) * 0.6)
      const segs = Math.max(1, Math.round(branchLen / s.segment))
      const segLen = branchLen / segs

      pos.set(dirX * trunkR, y, dirZ * trunkR)
      for (let k = 0; k < segs; k++) {
        const along = (k + 0.5) / segs
        const pitch = pitch0 - droop * Math.pow(along, 1.4)
        fwd.set(Math.cos(pitch) * dirX, Math.sin(pitch), Math.cos(pitch) * dirZ).normalize()
        side.set(-dirZ, 0, dirX)
        const roll = (rand() - 0.5) * 0.9 + (k % 2 ? 0.25 : -0.25)
        up.crossVectors(side, fwd).normalize()
        side.multiplyScalar(Math.cos(roll)).addScaledVector(up, Math.sin(roll)).normalize()

        const cardLen = (segLen * s.cardScale + 0.15) * (lowDetail ? 1.3 : 1)
        base.copy(pos).addScaledVector(fwd, -segLen * 0.15)
        radial.set(pos.x, 0, pos.z).normalize()
        const cardNormal = up.crossVectors(side, fwd).normalize()
        if (cardNormal.y < 0) cardNormal.negate()
        shade.copy(radial).multiplyScalar(0.75).addScaledVector(cardNormal, 0.6)
        shade.y += 0.25
        shade.normalize()
        const ao = (0.35 + 0.65 * Math.pow((k + 1) / segs, 0.6)) * (0.62 + 0.38 * t)
        cards.add(base, fwd, side, cardLen, pick(), shade, ao, s.width * (lowDetail ? 1.25 : 1))

        if (!lowDetail && rand() < s.cross) {
          const roll2 = roll > 0 ? -0.7 : 0.7
          const side2 = new Vector3(-dirZ, 0, dirX)
          const up2 = new Vector3().crossVectors(side2, fwd).normalize()
          side2.multiplyScalar(Math.cos(roll2)).addScaledVector(up2, Math.sin(roll2)).normalize()
          cards.add(base, fwd, side2, cardLen * 0.85, pick(), shade, ao * 0.85, s.width)
        }
        // larch: soft branchlets hanging below the limbs
        if (!lowDetail && k > 0 && rand() < s.hanging) {
          const hang = new Vector3(dirX * 0.3, -1, dirZ * 0.3).normalize()
          const hangBase = pos.clone().addScaledVector(fwd, segLen * 0.3)
          cards.add(hangBase, hang, new Vector3(-dirZ, 0, dirX), segLen * 1.1, SPRAYS[2 + Math.floor(rand() * 3)], radial, ao * 0.9, s.width)
        }
        pos.addScaledVector(fwd, segLen)
      }
    }
  }

  // leader
  const top = new Vector3(0, height - 0.6, 0)
  for (let i = 0; i < 2; i++) {
    const a = (i * Math.PI) / 2
    cards.add(top, new Vector3(0, 1, 0), new Vector3(Math.cos(a), 0, Math.sin(a)), 0.9, pick(), new Vector3(0, 1, 0), 1, s.width)
  }

  return { bark: createTrunk(height, rand, s.crownBase), foliage: cards.build() }
}
