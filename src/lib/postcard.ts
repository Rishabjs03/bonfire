import { captureFrame } from './captureQueue'

export const SITE = 'bonfire.rishabjs.xyz'
const MAX_WIDTH = 1600

const INK = '#f2ebe1'
const EMBER = '#f2a35e'
const SERIF = "'Instrument Serif', 'Iowan Old Style', Georgia, serif"
const SANS = "'Instrument Sans', ui-sans-serif, system-ui, sans-serif"

export const postcardDate = (d = new Date()) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

async function loadFonts() {
  try {
    await Promise.all([document.fonts.load(`italic 40px ${SERIF}`), document.fonts.load(`500 14px ${SANS}`), document.fonts.ready])
  } catch {
    // fonts unavailable: the fallbacks are fine
  }
}

/** Draw text with letter spacing, for browsers without ctx.letterSpacing. */
function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: 'left' | 'right') {
  const chars = [...text]
  const width = chars.reduce((w, c) => w + ctx.measureText(c).width + spacing, -spacing)
  let cx = align === 'right' ? x - width : x
  ctx.textAlign = 'left'
  for (const c of chars) {
    ctx.fillText(c, cx, y)
    cx += ctx.measureText(c).width + spacing
  }
}

/** The frame with the name, place and date in the corner, as the real postcard. */
export function composePostcard(frame: HTMLCanvasElement, name: string, date = postcardDate()) {
  const scale = Math.min(1, MAX_WIDTH / frame.width)
  const w = Math.round(frame.width * scale)
  const h = Math.round(frame.height * scale)
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.drawImage(frame, 0, 0, w, h)

  // a soft dusk at the bottom for the text to sit in
  const grad = ctx.createLinearGradient(0, h * 0.55, 0, h)
  grad.addColorStop(0, 'rgba(18,15,12,0)')
  grad.addColorStop(1, 'rgba(18,15,12,0.72)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  const pad = Math.round(w * 0.04)
  const nameSize = Math.round(w * 0.036)
  const captionSize = Math.round(w * 0.0125)
  ctx.textBaseline = 'alphabetic'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = nameSize * 0.3
  ctx.shadowOffsetY = 1

  // name, with a small ember before it
  const nameY = h - pad - captionSize * 2.1
  ctx.font = `italic ${nameSize}px ${SERIF}`
  ctx.fillStyle = INK
  ctx.textAlign = 'left'
  const dot = nameSize * 0.16
  ctx.save()
  ctx.shadowBlur = dot * 3
  ctx.shadowColor = 'rgba(242,163,94,0.8)'
  ctx.fillStyle = EMBER
  ctx.beginPath()
  ctx.arc(pad + dot, nameY - nameSize * 0.3, dot, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.fillText(name, pad + dot * 3.4, nameY)

  // place · altitude · date
  ctx.font = `500 ${captionSize}px ${SANS}`
  ctx.fillStyle = 'rgba(242,235,225,0.72)'
  spaced(ctx, `RIFFELALP · 2,110 M · ${date.toUpperCase()}`, pad, h - pad, captionSize * 0.14, 'left')

  // where to find the fire
  ctx.fillStyle = 'rgba(242,235,225,0.5)'
  spaced(ctx, SITE, w - pad, h - pad, captionSize * 0.05, 'right')
  return out
}

const toBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'))

export type PostcardOutcome = 'shared' | 'saved' | 'cancelled'

/** Share the postcard where the browser can, otherwise download it. */
export async function deliverPostcard(canvas: HTMLCanvasElement): Promise<PostcardOutcome> {
  const blob = await toBlob(canvas)
  const filename = `bonfire-${new Date().toISOString().slice(0, 10)}.png`
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: 'Bonfire' })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // sharing unavailable after all: fall through to a download
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'saved'
}

/** Take the postcard: grab the next frame, letter it, and hand it over. */
export async function takePostcard(name: string): Promise<PostcardOutcome> {
  const [frame] = await Promise.all([captureFrame(), loadFonts()])
  return deliverPostcard(composePostcard(frame, name))
}
