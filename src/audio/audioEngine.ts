/**
 * Procedural soundscape, no audio files: a crackling fire (noise bed + random pops and
 * snaps) that gets louder, brighter and pans with where it is relative to you; wind
 * moving through the trees in slow gusts; and snow crunching under your boots.
 */

const MUTE_KEY = 'bonfire-muted'

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    } else {
      data[i] = white
    }
  }
  return buf
}

export interface AudioFrame {
  /** Distance from the listener to the fire, metres. */
  fireDistance: number
  /** -1 (left) .. 1 (right) */
  firePan: number
  /** Fire flicker multiplier, ~0.75..1.25 */
  flicker: number
}

class AudioEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private fireIn!: GainNode
  private fireBed!: GainNode
  private fireFilter!: BiquadFilterNode
  private firePan!: StereoPannerNode
  private fireOut!: GainNode
  private windOut!: GainNode
  private windFilter!: BiquadFilterNode
  private windGust!: GainNode
  private windPan!: StereoPannerNode
  private stepsOut!: GainNode
  private white!: AudioBuffer
  private nearness = 0
  private timers: number[] = []
  muted = readMuted()
  private listeners = new Set<(muted: boolean) => void>()

  /** Must be called from a user gesture (browser autoplay rules). Safe to call twice. */
  start() {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    const ctx = new AudioContext()
    this.ctx = ctx
    this.white = noiseBuffer(ctx, 2, false)
    const brown = noiseBuffer(ctx, 6, true)

    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 3
    comp.connect(ctx.destination)
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.9
    this.master.connect(comp)

    // --- fire: everything flows through a distance lowpass + panner -------------------
    this.fireOut = ctx.createGain()
    this.fireOut.gain.value = 0
    this.firePan = ctx.createStereoPanner()
    this.fireFilter = ctx.createBiquadFilter()
    this.fireFilter.type = 'lowpass'
    this.fireFilter.frequency.value = 2000
    this.fireIn = ctx.createGain()
    this.fireIn.connect(this.fireFilter).connect(this.firePan).connect(this.fireOut).connect(this.master)

    // low roar of burning wood
    const roar = ctx.createBufferSource()
    roar.buffer = brown
    roar.loop = true
    const roarFilter = ctx.createBiquadFilter()
    roarFilter.type = 'lowpass'
    roarFilter.frequency.value = 700
    this.fireBed = ctx.createGain()
    this.fireBed.gain.value = 0.5
    roar.connect(roarFilter).connect(this.fireBed).connect(this.fireIn)
    roar.start()

    // soft hiss of gases
    const hiss = ctx.createBufferSource()
    hiss.buffer = this.white
    hiss.loop = true
    const hissFilter = ctx.createBiquadFilter()
    hissFilter.type = 'bandpass'
    hissFilter.frequency.value = 3200
    hissFilter.Q.value = 0.6
    const hissGain = ctx.createGain()
    hissGain.gain.value = 0.025
    hiss.connect(hissFilter).connect(hissGain).connect(this.fireIn)
    hiss.start()

    // --- wind ----------------------------------------------------------------------
    this.windOut = ctx.createGain()
    this.windOut.gain.value = 0.2
    this.windPan = ctx.createStereoPanner()
    this.windGust = ctx.createGain()
    this.windGust.gain.value = 0.6
    this.windFilter = ctx.createBiquadFilter()
    this.windFilter.type = 'lowpass'
    this.windFilter.frequency.value = 450
    this.windFilter.Q.value = 0.7
    const wind = ctx.createBufferSource()
    wind.buffer = brown
    wind.loop = true
    wind.playbackRate.value = 0.8
    wind.connect(this.windFilter).connect(this.windGust).connect(this.windPan).connect(this.windOut).connect(this.master)
    wind.start()
    // a faint whistle through the needles, riding the gusts
    const needles = ctx.createBufferSource()
    needles.buffer = this.white
    needles.loop = true
    const needleFilter = ctx.createBiquadFilter()
    needleFilter.type = 'bandpass'
    needleFilter.frequency.value = 1900
    needleFilter.Q.value = 5
    const needleGain = ctx.createGain()
    needleGain.gain.value = 0.012
    needles.connect(needleFilter).connect(needleGain).connect(this.windGust)
    needles.start()

    // --- footsteps -----------------------------------------------------------------
    this.stepsOut = ctx.createGain()
    this.stepsOut.gain.value = 0.32
    this.stepsOut.connect(this.master)

    this.scheduleCrackle()
    this.scheduleGust()
  }

  onMuteChange(fn: (muted: boolean) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  setMuted(muted: boolean) {
    this.muted = muted
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
    } catch {
      // storage unavailable (private mode): the setting just won't persist
    }
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.15)
    this.listeners.forEach((fn) => fn(muted))
  }

  toggleMuted() {
    this.setMuted(!this.muted)
  }

  /** Per-frame update from the scene. */
  update({ fireDistance, firePan, flicker }: AudioFrame) {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const t = ctx.currentTime
    const near = 1 / (1 + (fireDistance / 3.2) ** 2)
    this.nearness = near
    this.fireOut.gain.setTargetAtTime(0.015 + near * 1.1, t, 0.12)
    this.fireFilter.frequency.setTargetAtTime(350 + 9000 * Math.pow(near, 0.75), t, 0.12)
    this.firePan.pan.setTargetAtTime(Math.max(-1, Math.min(1, firePan)) * (0.35 + 0.5 * near), t, 0.1)
    this.fireBed.gain.setTargetAtTime(0.35 + (flicker - 1) * 0.8, t, 0.05)
    this.windOut.gain.setTargetAtTime(0.22 * (1 - 0.65 * near), t, 0.4)
  }

  /** One boot crunching into snow. */
  footstep(weight = 1) {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const t = ctx.currentTime
    const grains = 4 + Math.floor(Math.random() * 4)
    for (let i = 0; i < grains; i++) {
      const at = t + i * (0.012 + Math.random() * 0.02)
      const src = ctx.createBufferSource()
      src.buffer = this.white
      src.playbackRate.value = 0.7 + Math.random() * 0.6
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1300 + Math.random() * 1800
      bp.Q.value = 0.9
      const g = ctx.createGain()
      const peak = (0.12 + Math.random() * 0.2) * weight * (i === 0 ? 1.4 : 1)
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(peak, at + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0008, at + 0.03 + Math.random() * 0.04)
      src.connect(bp).connect(g).connect(this.stepsOut)
      src.start(at, Math.random() * 1.5, 0.1)
    }
    // the dull compression thump underneath
    const thump = ctx.createBufferSource()
    thump.buffer = this.white
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 220
    const tg = ctx.createGain()
    tg.gain.setValueAtTime(0, t)
    tg.gain.linearRampToValueAtTime(0.5 * weight, t + 0.01)
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
    thump.connect(lp).connect(tg).connect(this.stepsOut)
    thump.start(t, Math.random(), 0.12)
  }

  private crackle() {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime + 0.01
    const big = Math.random() < 0.06
    const src = ctx.createBufferSource()
    src.buffer = this.white
    src.playbackRate.value = 0.6 + Math.random()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = big ? 500 + Math.random() * 700 : 1400 + Math.random() * 5000
    bp.Q.value = big ? 1.2 : 0.6 + Math.random() * 2.5
    const g = ctx.createGain()
    const amp = big ? 0.9 + Math.random() * 0.6 : 0.08 + Math.pow(Math.random(), 3) * 0.7
    const decay = big ? 0.08 + Math.random() * 0.08 : 0.006 + Math.random() * 0.04
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(amp, t + 0.001)
    g.gain.exponentialRampToValueAtTime(0.0005, t + decay)
    src.connect(bp).connect(g).connect(this.fireIn)
    src.start(t, Math.random() * 1.8, decay + 0.02)
  }

  private scheduleCrackle() {
    // Poisson-ish: mostly sparse ticks, with occasional rapid bursts like real burning wood.
    const burst = Math.random() < 0.12
    const count = burst ? 3 + Math.floor(Math.random() * 6) : 1
    for (let i = 0; i < count; i++) {
      this.timers.push(window.setTimeout(() => this.crackle(), i * (15 + Math.random() * 45)))
    }
    const wait = -Math.log(1 - Math.random()) * (burst ? 260 : 140)
    this.timers.push(window.setTimeout(() => this.scheduleCrackle(), wait))
    if (this.timers.length > 200) this.timers.splice(0, 100)
  }

  private scheduleGust() {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const strength = 0.35 + Math.random() * 0.75
    const dur = 2.5 + Math.random() * 5
    this.windGust.gain.setTargetAtTime(strength, t, dur / 3)
    this.windFilter.frequency.setTargetAtTime(260 + strength * 520, t, dur / 3)
    this.windPan.pan.setTargetAtTime((Math.random() - 0.5) * 1.2, t, dur / 2)
    this.timers.push(window.setTimeout(() => this.scheduleGust(), dur * 1000))
  }

  /** How close you are to the fire, 0..1 (used for other cozy cues). */
  get fireNearness() {
    return this.nearness
  }
}

export const audioEngine = new AudioEngine()
