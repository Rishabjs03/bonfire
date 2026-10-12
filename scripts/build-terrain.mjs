// Bakes the real Riffelalp/Zermatt landscape for Bonfire.
// Sources: swisstopo swissALTI3D (2 m DEM) + SWISSIMAGE (orthophoto) [© swisstopo],
//          AWS Terrain Tiles (Terrarium) as DEM fallback outside swissALTI3D coverage.
// Usage: node build-terrain.mjs <cacheDir> <outDir>
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const [CACHE, OUT] = process.argv.slice(2)
fs.mkdirSync(OUT, { recursive: true })

// ---------------------------------------------------------------- configuration
const CAMP = { lat: 46.00065, lon: 7.74672 }
const MATTERHORN = { lat: 45.97636, lon: 7.65861 }
const R0 = 110 // polar terrain starts here (m); the local scene covers the inside
const RMAX = 26000
const NA = 2048 // angular samples of the terrain mesh
const NR = 400 // radial rings (log spaced)
const TEX_W = 4096 // ortho / normal textures (u = bearing, v = log radius)
const TEX_H = 2048
const SHADOW_W = 2048
const SHADOW_H = 1024
const LOCAL_N = 256 // local height grid
const LOCAL_HALF = 170 // metres
const SUN_ELEV = 6.3 // degrees, matches syferfontein_6d_clear_puresky
const UA = { 'User-Agent': 'bonfire-dev/1.0 (one-off asset preparation)' }

// ---------------------------------------------------------------- geo helpers
const M_LAT = 111132.0
const M_LON = 111320.0 * Math.cos((CAMP.lat * Math.PI) / 180)
const toLonLat = (east, north) => ({ lon: CAMP.lon + east / M_LON, lat: CAMP.lat + north / M_LAT })
const toEN = (lat, lon) => ({ east: (lon - CAMP.lon) * M_LON, north: (lat - CAMP.lat) * M_LAT })

function lonLatToPx(lon, lat, z) {
  const n = 2 ** z * 256
  const x = ((lon + 180) / 360) * n
  const r = (lat * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n
  return [x, y]
}

/** swisstopo approximate WGS84 → LV95 (≈1 m). */
function toLV95(lat, lon) {
  const p = (lat * 3600 - 169028.66) / 10000
  const l = (lon * 3600 - 26782.5) / 10000
  const E = 2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p * p - 44.54 * l ** 3
  const N = 1200147.07 + 308807.95 * p + 3745.25 * l * l + 76.63 * p * p - 194.56 * l * l * p + 119.79 * p ** 3
  return [E, N]
}

// ---------------------------------------------------------------- downloads
async function fetchTo(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: UA })
      if (res.status === 404 || res.status === 400) return null
      if (!res.ok) throw new Error(`${res.status}`)
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
      return file
    } catch (e) {
      if (attempt === 2) {
        console.warn('failed', url, e.message)
        return null
      }
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
    }
  }
}

async function pool(items, n, fn) {
  let i = 0
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) await fn(items[i++])
    }),
  )
}

function decodeRGB(file) {
  const raw = file + '.rgb'
  if (!fs.existsSync(raw)) execFileSync('magick', [file, '-resize', '256x256!', '-depth', '8', `rgb:${raw}`])
  return new Uint8Array(fs.readFileSync(raw))
}

function decodeF32(file) {
  const raw = file + '.f32'
  if (!fs.existsSync(raw))
    execFileSync('magick', [`${file}[0]`, '-define', 'quantum:format=floating-point', '-depth', '32', '-endian', 'LSB', `gray:${raw}`])
  const b = fs.readFileSync(raw)
  return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4)
}

// ---------------------------------------------------------------- tile samplers
class XYZSampler {
  constructor(name, urlFmt, ext) {
    this.name = name
    this.url = urlFmt
    this.ext = ext
    this.dir = path.join(CACHE, name)
    fs.mkdirSync(this.dir, { recursive: true })
    this.tiles = new Map()
  }
  key(z, x, y) {
    return z * 1e12 + x * 1e6 + y
  }
  async ensure(keys) {
    const missing = [...keys].filter((k) => !this.tiles.has(this.key(...k.split('/').map(Number))))
    await pool(missing, 8, async (k) => {
      const [z, x, y] = k.split('/').map(Number)
      const f = await fetchTo(this.url.replace('{z}', z).replace('{x}', x).replace('{y}', y), path.join(this.dir, `${z}_${x}_${y}.${this.ext}`))
      let data = null
      if (f) {
        try {
          data = decodeRGB(f)
          // SWISSIMAGE returns blank white tiles outside Switzerland: treat as missing
          let blank = 0
          for (let i = 0; i < data.length; i += 3 * 7) if (data[i] > 243 && data[i + 1] > 243 && data[i + 2] > 243) blank++
          if (blank > (data.length / 21) * 0.6) data = null
        } catch {
          data = null
        }
      }
      this.tiles.set(this.key(z, x, y), data)
    })
  }
  /** Bilinear RGB at global pixel coords for zoom z, or null if the tile is missing. */
  sample(z, px, py, out) {
    const fx = px - 0.5
    const fy = py - 0.5
    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    const ax = fx - x0
    const ay = fy - y0
    out[0] = out[1] = out[2] = 0
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < 2; i++) {
        const gx = x0 + i
        const gy = y0 + j
        const t = this.tiles.get(this.key(z, gx >> 8, gy >> 8))
        if (!t) return false
        const o = (((gy & 255) << 8) + (gx & 255)) * 3
        const w = (i ? ax : 1 - ax) * (j ? ay : 1 - ay)
        out[0] += t[o] * w
        out[1] += t[o + 1] * w
        out[2] += t[o + 2] * w
      }
    }
    return true
  }
}

const ortho = new XYZSampler('swissimage', 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg', 'jpeg')
const terrarium = new XYZSampler('terrarium', 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png', 'png')

function tilesForRadius(z, radius) {
  const keys = new Set()
  const a = toLonLat(-radius, radius)
  const b = toLonLat(radius, -radius)
  const [x0, y0] = lonLatToPx(a.lon, a.lat, z)
  const [x1, y1] = lonLatToPx(b.lon, b.lat, z)
  for (let ty = Math.floor(y0 / 256); ty <= Math.floor(y1 / 256); ty++)
    for (let tx = Math.floor(x0 / 256); tx <= Math.floor(x1 / 256); tx++) keys.add(`${z}/${tx}/${ty}`)
  return keys
}

// ---------------------------------------------------------------- swissALTI3D
const alti = new Map() // "E-N" km → Float32Array(500*500)
const altiNum = new Map() // E*10000+N → same, for fast lookups
async function loadAlti(centerLat, centerLon, halfKm) {
  const [E, N] = toLV95(centerLat, centerLon)
  const ids = []
  for (let e = Math.floor(E / 1000 - halfKm); e <= Math.floor(E / 1000 + halfKm); e++)
    for (let n = Math.floor(N / 1000 - halfKm); n <= Math.floor(N / 1000 + halfKm); n++) ids.push(`${e}-${n}`)
  const want = ids.filter((id) => !alti.has(id))
  await pool(want, 4, async (id) => {
    const dir = path.join(CACHE, 'alti')
    fs.mkdirSync(dir, { recursive: true })
    const meta = path.join(dir, `${id}.json`)
    if (!fs.existsSync(meta)) {
      const [e, n] = id.split('-').map(Number)
      // find newest year for this tile via STAC (bbox = tile centre)
      const c = fromLV95(e * 1000 + 500, n * 1000 + 500)
      const url = `https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swissalti3d/items?bbox=${c.lon - 0.0005},${c.lat - 0.0005},${c.lon + 0.0005},${c.lat + 0.0005}&limit=20`
      const res = await fetch(url, { headers: UA })
      const json = await res.json()
      const items = (json.features ?? []).filter((f) => f.id.endsWith(id)).sort((a, b) => b.id.localeCompare(a.id))
      const href = items[0] && Object.values(items[0].assets).find((a) => a.href.endsWith('_2_2056_5728.tif'))?.href
      fs.writeFileSync(meta, JSON.stringify({ href: href ?? null }))
    }
    const { href } = JSON.parse(fs.readFileSync(meta, 'utf8'))
    if (!href) {
      alti.set(id, null)
      return
    }
    const f = await fetchTo(href, path.join(dir, `${id}.tif`))
    alti.set(id, f ? decodeF32(f) : null)
  })
  for (const [id, t] of alti) {
    const [e, n] = id.split('-').map(Number)
    altiNum.set(e * 10000 + n, t)
  }
}

/** Inverse of toLV95 (approximate, swisstopo formulas). */
function fromLV95(E, N) {
  const y = (E - 2600000) / 1e6
  const x = (N - 1200000) / 1e6
  const l = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y ** 3
  const p = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.014 * x ** 3
  return { lon: (l * 100) / 36, lat: (p * 100) / 36 }
}

function altiAt(lat, lon) {
  const [E, N] = toLV95(lat, lon)
  const ek = Math.floor(E / 1000)
  const nk = Math.floor(N / 1000)
  const t = altiNum.get(ek * 10000 + nk)
  if (!t) return null
  // 2 m cells, row 0 at the north edge
  const fx = (E - ek * 1000) / 2 - 0.5
  const fy = (nk * 1000 + 1000 - N) / 2 - 0.5
  const x0 = Math.max(0, Math.min(498, Math.floor(fx)))
  const y0 = Math.max(0, Math.min(498, Math.floor(fy)))
  const ax = Math.min(1, Math.max(0, fx - x0))
  const ay = Math.min(1, Math.max(0, fy - y0))
  const i = y0 * 500 + x0
  const v = [t[i], t[i + 1], t[i + 500], t[i + 501]]
  if (v.some((h) => !(h > 0))) return null
  return (v[0] * (1 - ax) + v[1] * ax) * (1 - ay) + (v[2] * (1 - ax) + v[3] * ax) * ay
}

const tmp = [0, 0, 0]
function terrariumAt(lat, lon, z) {
  const [px, py] = lonLatToPx(lon, lat, z)
  if (!terrarium.sample(z, px, py, tmp)) return null
  return tmp[0] * 256 + tmp[1] + tmp[2] / 256 - 32768
}

/** Best available elevation (m) at local east/north. */
function heightEN(east, north) {
  const { lat, lon } = toLonLat(east, north)
  const a = altiAt(lat, lon)
  if (a !== null) return a
  const r = Math.hypot(east, north)
  return terrariumAt(lat, lon, r < 3000 ? 15 : 13) ?? terrariumAt(lat, lon, 13) ?? 2000
}

// ---------------------------------------------------------------- main
const t0 = Date.now()
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a)

log('swissALTI3D: camp and Matterhorn')
await loadAlti(CAMP.lat, CAMP.lon, 2)
await loadAlti(MATTERHORN.lat, MATTERHORN.lon, 1.3)
log('alti tiles', [...alti.values()].filter(Boolean).length)

log('terrarium DEM tiles')
await terrarium.ensure(new Set([...tilesForRadius(15, 3200), ...tilesForRadius(13, RMAX + 2000)]))

const campAlt = heightEN(0, 0)
const mh = toEN(MATTERHORN.lat, MATTERHORN.lon)
log('camp altitude', campAlt.toFixed(1), '| Matterhorn summit', heightEN(mh.east, mh.north).toFixed(1), 'at', Math.hypot(mh.east, mh.north).toFixed(0), 'm')

// --- sun: summer evening sun from the west-northwest; choose the bearing where the camp is lit
const sunElev = (SUN_ELEV * Math.PI) / 180
function horizonAngle(east, north, h, bearing) {
  const dx = Math.sin(bearing)
  const dy = Math.cos(bearing)
  let max = -1
  for (let d = 20; d < RMAX; d *= 1.04) max = Math.max(max, Math.atan2(heightEN(east + dx * d, north + dy * d) - h, d))
  return max
}
// SUN=sunrise bakes the morning sun from the east instead of the evening sun.
const MORNING = process.env.SUN === 'sunrise'
let sunBearing = ((MORNING ? 93 : 285) * Math.PI) / 180
const options = []
for (let b = MORNING ? 75 : 255; b <= (MORNING ? 115 : 305); b += 2) {
  const ang = horizonAngle(0, 0, campAlt + 1.7, (b * Math.PI) / 180)
  options.push([b, (ang * 180) / Math.PI])
}
log('horizon toward the evening sun:', options.map(([b, a]) => `${b}°:${a.toFixed(1)}`).join(' '))
// prefer a lit camp (horizon below the sun), nearest to a realistic late-August bearing of ~285°
// mid-September: at 6° altitude the sun stands around bearing 268–275°
const lit = options.filter(([, a]) => a < SUN_ELEV - 0.1).sort((p, q) => Math.abs(p[0] - 272) - Math.abs(q[0] - 272))
if (lit.length && !MORNING) sunBearing = (lit[0][0] * Math.PI) / 180
const campLitAngle = Math.min(...options.map(([b, a]) => (Math.abs(b - (sunBearing * 180) / Math.PI) < 1.5 ? a : 99)))
log('sun bearing', ((sunBearing * 180) / Math.PI).toFixed(0), lit.length ? '(camp in sunlight)' : '(camp in shade: valley evening)')

// --- local height grid (relative to camp)
log('local grid')
const local = new Float32Array(LOCAL_N * LOCAL_N)
for (let j = 0; j < LOCAL_N; j++)
  for (let i = 0; i < LOCAL_N; i++) {
    const east = -LOCAL_HALF + (i / (LOCAL_N - 1)) * 2 * LOCAL_HALF
    const north = LOCAL_HALF - (j / (LOCAL_N - 1)) * 2 * LOCAL_HALF
    local[j * LOCAL_N + i] = heightEN(east, north) - campAlt
  }
fs.writeFileSync(path.join(OUT, 'local.bin'), Buffer.from(local.buffer))

// --- polar heights
log('polar heights')
const ringR = (k) => R0 * (RMAX / R0) ** (k / (NR - 1))
const polar = new Uint16Array(NA * NR)
for (let k = 0; k < NR; k++) {
  const r = ringR(k)
  for (let a = 0; a < NA; a++) {
    const b = (a / NA) * Math.PI * 2
    polar[k * NA + a] = Math.round(Math.max(0, heightEN(Math.sin(b) * r, Math.cos(b) * r)) * 4)
  }
}
fs.writeFileSync(path.join(OUT, 'polar.bin'), Buffer.from(polar.buffer))

// --- orthophoto: choose a zoom per radius matching the angular footprint
const texR = (v) => R0 * (RMAX / R0) ** v
const zoomFor = (r) => Math.max(11, Math.min(17, Math.round(Math.log2(108745 / ((2 * Math.PI * r) / TEX_W)))))
log('orthophoto tiles')
const orthoKeys = new Set()
for (let row = 0; row < TEX_H; row += 4) {
  const r = texR(row / (TEX_H - 1))
  const z = zoomFor(r)
  for (let col = 0; col < TEX_W; col += 4) {
    const b = (col / TEX_W) * Math.PI * 2
    const { lat, lon } = toLonLat(Math.sin(b) * r, Math.cos(b) * r)
    const [px, py] = lonLatToPx(lon, lat, z)
    orthoKeys.add(`${z}/${Math.floor(px / 256)}/${Math.floor(py / 256)}`)
  }
}
log('ortho tile count', orthoKeys.size)
await ortho.ensure(orthoKeys)

log('baking ortho + normals')
const orthoTex = new Uint8Array(TEX_W * TEX_H * 3)
const normalTex = new Uint8Array(TEX_W * TEX_H * 3)
const rgb = [0, 0, 0]
for (let row = 0; row < TEX_H; row++) {
  const r = texR(row / (TEX_H - 1))
  const z = zoomFor(r)
  const step = Math.max(2, (2 * Math.PI * r) / TEX_W)
  for (let col = 0; col < TEX_W; col++) {
    const b = ((col + 0.5) / TEX_W) * Math.PI * 2
    const east = Math.sin(b) * r
    const north = Math.cos(b) * r
    const o = (row * TEX_W + col) * 3
    const { lat, lon } = toLonLat(east, north)
    let ok = false
    for (let zz = z; zz >= 11 && !ok; zz--) {
      const [px, py] = lonLatToPx(lon, lat, zz)
      // pure white = no imagery (outside Switzerland)
      ok = ortho.sample(zz, px, py, rgb) && !(rgb[0] > 249 && rgb[1] > 249 && rgb[2] > 249)
    }
    const h = heightEN(east, north)
    const dhdx = (heightEN(east + step, north) - heightEN(east - step, north)) / (2 * step)
    const dhdn = (heightEN(east, north + step) - heightEN(east, north - step)) / (2 * step)
    // world normal in app coords (x = east, y = up, z = south)
    let nx = -dhdx
    let ny = 1
    let nz = dhdn
    const nl = Math.hypot(nx, ny, nz)
    nx /= nl
    ny /= nl
    nz /= nl
    if (!ok) {
      // outside SWISSIMAGE (Italy): plausible colour from altitude and slope
      const steep = 1 - ny
      const snow = h > 3250 && steep < 0.42
      const n = Math.sin(east * 0.011) * Math.cos(north * 0.013) * 10
      const c = snow
        ? [214 + n, 220 + n, 228 + n]
        : steep > 0.3 || h > 2750
          ? [118 + n, 112 + n, 104 + n]
          : h < 2000
            ? [64 + n, 78 + n, 52 + n]
            : [112 + n, 116 + n, 84 + n]
      rgb[0] = c[0]
      rgb[1] = c[1]
      rgb[2] = c[2]
    }
    orthoTex[o] = rgb[0]
    orthoTex[o + 1] = rgb[1]
    orthoTex[o + 2] = rgb[2]
    normalTex[o] = Math.round((nx * 0.5 + 0.5) * 255)
    normalTex[o + 1] = Math.round((ny * 0.5 + 0.5) * 255)
    normalTex[o + 2] = Math.round((nz * 0.5 + 0.5) * 255)
  }
  if (row % 256 === 0) log('  row', row)
}
const writeImage = (buf, w, h, channels, file, args = []) => {
  const raw = file + '.raw'
  fs.writeFileSync(raw, Buffer.from(buf.buffer))
  execFileSync('magick', ['-size', `${w}x${h}`, '-depth', '8', `${channels}:${raw}`, ...args, file])
  fs.unlinkSync(raw)
}
writeImage(orthoTex, TEX_W, TEX_H, 'rgb', path.join(OUT, 'ortho.jpg'), ['-quality', '88'])
writeImage(normalTex, TEX_W, TEX_H, 'rgb', path.join(OUT, 'normals.jpg'), ['-quality', '92'])

// --- sun shadow (soft): minimum clearance angle toward the sun, per texel
log('shadow height grid')
const SG = 50 // metres
const SGN = Math.ceil(((RMAX + 1500) * 2) / SG)
const SGH = (SGN * SG) / 2
const sgrid = new Float32Array(SGN * SGN)
for (let j = 0; j < SGN; j++) for (let i = 0; i < SGN; i++) sgrid[j * SGN + i] = heightEN(-SGH + i * SG, SGH - j * SG)
function gridH(east, north) {
  const fx = (east + SGH) / SG
  const fy = (SGH - north) / SG
  const x0 = Math.max(0, Math.min(SGN - 2, Math.floor(fx)))
  const y0 = Math.max(0, Math.min(SGN - 2, Math.floor(fy)))
  const ax = fx - x0
  const ay = fy - y0
  const i = y0 * SGN + x0
  return (sgrid[i] * (1 - ax) + sgrid[i + 1] * ax) * (1 - ay) + (sgrid[i + SGN] * (1 - ax) + sgrid[i + SGN + 1] * ax) * ay
}
log('baking sun shadows')
const shadowTex = new Uint8Array(SHADOW_W * SHADOW_H)
const sdx = Math.sin(sunBearing)
const sdy = Math.cos(sunBearing)
const tanSun = Math.tan(sunElev)
for (let row = 0; row < SHADOW_H; row++) {
  const r = texR(row / (SHADOW_H - 1))
  for (let col = 0; col < SHADOW_W; col++) {
    const b = ((col + 0.5) / SHADOW_W) * Math.PI * 2
    const east = Math.sin(b) * r
    const north = Math.cos(b) * r
    const h = heightEN(east, north) + 2
    let clearance = 1
    for (let d = 15; d < 30000; d *= 1.06) {
      const ex = east + sdx * d
      const ny2 = north + sdy * d
      if (Math.hypot(ex, ny2) > RMAX + 1500) break
      const c = (h + d * tanSun - (d < 300 ? heightEN(ex, ny2) : gridH(ex, ny2))) / d // tangent of clearance angle
      if (c < clearance) clearance = c
      if (clearance < -0.02) break
    }
    // soft penumbra across ~1°
    const lit = Math.max(0, Math.min(1, (clearance + 0.009) / 0.018))
    shadowTex[row * SHADOW_W + col] = Math.round(lit * 255)
  }
  if (row % 128 === 0) log('  row', row)
}
writeImage(shadowTex, SHADOW_W, SHADOW_H, 'gray', path.join(OUT, MORNING ? 'sunshadow_sunrise.png' : 'sunshadow.png'))

// --- trees from the real forest: local (3D) and distant (impostors)
log('trees from orthophoto')
const isForest = (c) => {
  const lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
  return lum < 64 && c[1] >= c[0] * 0.92
}
function treesInRing(rMin, rMax, spacing, z, maxCount) {
  const out = []
  let seed = 12345
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  for (let n = -rMax; n <= rMax; n += spacing)
    for (let e = -rMax; e <= rMax; e += spacing) {
      const je = e + (rand() - 0.5) * spacing * 0.9
      const jn = n + (rand() - 0.5) * spacing * 0.9
      const r = Math.hypot(je, jn)
      if (r < rMin || r > rMax) continue
      const { lat, lon } = toLonLat(je, jn)
      const [px, py] = lonLatToPx(lon, lat, z)
      if (!ortho.sample(z, px, py, rgb) || !isForest(rgb)) continue
      out.push(je, heightEN(je, jn) - campAlt, -jn, 0.75 + rand() * 0.5)
      if (out.length / 4 >= maxCount) return out
    }
  return out
}
await ortho.ensure(tilesForRadius(17, 175))
await ortho.ensure(tilesForRadius(16, 1600))
const localTrees = treesInRing(0, 165, 4.2, 17, 2500)
const farTrees = treesInRing(150, 1500, 9, 16, 60000)
fs.writeFileSync(path.join(OUT, 'trees_local.bin'), Buffer.from(new Float32Array(localTrees).buffer))
fs.writeFileSync(path.join(OUT, 'trees_far.bin'), Buffer.from(new Float32Array(farTrees).buffer))
log('trees local', localTrees.length / 4, 'far', farTrees.length / 4)

const meta = {
  camp: CAMP,
  campAltitude: campAlt,
  r0: R0,
  rMax: RMAX,
  na: NA,
  nr: NR,
  heightScale: 0.25,
  local: { n: LOCAL_N, half: LOCAL_HALF },
  sun: { bearing: (sunBearing * 180) / Math.PI, elevation: SUN_ELEV, campHorizon: campLitAngle },
  matterhorn: { east: mh.east, north: mh.north },
}
fs.writeFileSync(path.join(OUT, MORNING ? 'meta_sunrise.json' : 'meta.json'), JSON.stringify(meta, null, 2))
log('done', meta)
