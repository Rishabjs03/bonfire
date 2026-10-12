import { create } from 'zustand'

/**
 * Rendering quality. Starts from a guess based on the GPU, then steps down automatically
 * while the frame rate struggles (see PerformanceMonitor in App). `?quality=low|medium|high`
 * forces a level.
 */
export type QualityLevel = 0 | 1 | 2 // low, medium, high

export interface QualitySettings {
  dpr: number
  msaa: number
  ao: boolean
  shadowMapSize: number
  shadowRange: number
  grassCount: number
  grassRadius: number
  /** 3D trees with full detail within this distance of camp, light detail to `treesMid`, impostors beyond. */
  treesNear: number
  treesMid: number
  fireSteps: number
}

export const QUALITY: Record<QualityLevel, QualitySettings> = {
  0: { dpr: 0.85, msaa: 0, ao: false, shadowMapSize: 1024, shadowRange: 26, grassCount: 45_000, grassRadius: 14, treesNear: 18, treesMid: 36, fireSteps: 14 },
  1: { dpr: 1, msaa: 2, ao: false, shadowMapSize: 2048, shadowRange: 32, grassCount: 95_000, grassRadius: 20, treesNear: 28, treesMid: 52, fireSteps: 20 },
  2: { dpr: 1.4, msaa: 4, ao: true, shadowMapSize: 2048, shadowRange: 38, grassCount: 150_000, grassRadius: 26, treesNear: 38, treesMid: 72, fireSteps: 26 },
}

const KEY = 'bonfire-quality'

function initialLevel(): QualityLevel {
  const forced = new URLSearchParams(window.location.search).get('quality')
  if (forced === 'low') return 0
  if (forced === 'medium') return 1
  if (forced === 'high') return 2
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === '0' || saved === '1' || saved === '2') return Number(saved) as QualityLevel
  } catch {
    // storage unavailable: fall through to the GPU guess
  }
  // Rough GPU guess: start smooth (medium) unless it's clearly a strong GPU; the
  // performance monitor then steps up when there's headroom, or down when there isn't.
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    const name = ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''
    if (/Mali|Adreno|PowerVR|SwiftShader|llvmpipe|Microsoft Basic/i.test(name)) return 0
    if (/Intel|UHD|Iris|Vega \d|Radeon\(TM\) Graphics/i.test(name) || window.matchMedia('(pointer: coarse)').matches) return 0
    if (/RTX [2-9]\d|RX [6-9]\d{3}|Apple M\d (Pro|Max|Ultra)/i.test(name)) return 2
  } catch {
    return 1
  }
  return 1
}

interface QualityState {
  level: QualityLevel
  settings: QualitySettings
  stepDown: () => void
  stepUp: () => void
}

export const useQuality = create<QualityState>((set, get) => {
  const level = initialLevel()
  return {
    level,
    settings: QUALITY[level],
    stepDown: () => {
      const next = Math.max(0, get().level - 1) as QualityLevel
      if (next === get().level) return
      try {
        localStorage.setItem(KEY, String(next))
      } catch {
        // not persisted; fine
      }
      set({ level: next, settings: QUALITY[next] })
    },
    stepUp: () => {
      const next = Math.min(2, get().level + 1) as QualityLevel
      if (next === get().level) return
      set({ level: next, settings: QUALITY[next] })
    },
  }
})
