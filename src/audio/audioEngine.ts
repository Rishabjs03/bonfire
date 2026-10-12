/**
 * Procedural soundscape of a late-summer evening at Riffelalp, no audio files: a crackling
 * fire (noise bed + random pops and snaps) that gets louder, brighter and pans with where it
 * is relative to you; a breeze moving through the larches; crickets in the meadow; distant
 * cowbells echoing off the valley; and footsteps swishing through the grass.
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
  private ambientOut!: GainNode
  private sizzle!: GainNode
  private echo!: DelayNode
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
    this.windOut.gain.value = 0.14
    this.windPan = ctx.createStereoPanner()
    this.windGust = ctx.createGain()
    this.windGust.gain.value = 0.6
    this.windFilter = ctx.createBiquadFilter()
    this.windFilter.type = 'lowpass'
    this.windFilter.frequency.value = 650
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

    // --- meadow & valley ambience: crickets near, cowbells far, a valley echo ----------
    this.ambientOut = ctx.createGain()
    this.ambientOut.connect(this.master)
    this.echo = ctx.createDelay(1)
    this.echo.delayTime.value = 0.42
    const echoFeedback = ctx.createGain()
    echoFeedback.gain.value = 0.32
    const echoTone = ctx.createBiquadFilter()
    echoTone.type = 'lowpass'
    echoTone.frequency.value = 1800
    this.echo.connect(echoTone).connect(echoFeedback).connect(this.echo)
    echoTone.connect(this.ambientOut)

    // --- a marshmallow sizzling over the fire -----------------------------------------
    const sizzleSrc = ctx.createBufferSource()
    sizzleSrc.buffer = this.white
    sizzleSrc.loop = true
    const sizzleFilter = ctx.createBiquadFilter()
    sizzleFilter.type = 'bandpass'
    sizzleFilter.frequency.value = 5200
    sizzleFilter.Q.value = 0.9
    this.sizzle = ctx.createGain()
    this.sizzle.gain.value = 0
    sizzleSrc.connect(sizzleFilter).connect(this.sizzle).connect(this.master)
    sizzleSrc.start()

    this.scheduleCrackle()
    this.scheduleGust()
    for (let i = 0; i < 4; i++) this.scheduleCricket(i)
    for (let i = 0; i < 3; i++) this.scheduleCow(i)
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
    this.windOut.gain.setTargetAtTime(0.15 * (1 - 0.5 * near), t, 0.4)
    this.ambientOut.gain.setTargetAtTime(1 - 0.45 * near, t, 0.5)
  }

  /** One boot swishing through dry grass. */
  footstep(weight = 1) {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.white
    src.playbackRate.value = 0.8 + Math.random() * 0.4
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 0.8
    // the rustle sweeps up as the leg brushes through
    bp.frequency.setValueAtTime(1800 + Math.random() * 600, t)
    bp.frequency.linearRampToValueAtTime(4200 + Math.random() * 1500, t + 0.16)
    const g = ctx.createGain()
    const peak = (0.09 + Math.random() * 0.06) * weight
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.22 + Math.random() * 0.08)
    src.connect(bp).connect(g).connect(this.stepsOut)
    src.start(t, Math.random() * 1.5, 0.35)
    // the soft heel landing on turf
    const thump = ctx.createBufferSource()
    thump.buffer = this.white
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 160
    const tg = ctx.createGain()
    tg.gain.setValueAtTime(0, t + 0.04)
    tg.gain.linearRampToValueAtTime(0.25 * weight, t + 0.05)
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    thump.connect(lp).connect(tg).connect(this.stepsOut)
    thump.start(t + 0.04, Math.random(), 0.12)
  }

  /** A marmot's alarm call: a piercing two-note whistle from the rocks, echoing off the valley. */
  marmotWhistle(pan: number, distance: number) {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const t0 = ctx.currentTime + 0.02
    const level = ctx.createGain()
    level.gain.value = 0.3 / (1 + distance / 12)
    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, pan))
    panner.connect(level)
    level.connect(this.ambientOut)
    level.connect(this.echo)
    for (const [start, freq, dur] of [
      [0, 2900, 0.16],
      [0.21, 2450, 0.24],
    ]) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq * 1.08, t0 + start)
      osc.frequency.exponentialRampToValueAtTime(freq, t0 + start + dur)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t0 + start)
      g.gain.linearRampToValueAtTime(1, t0 + start + 0.008)
      g.gain.exponentialRampToValueAtTime(0.001, t0 + start + dur)
      osc.connect(g).connect(panner)
      osc.start(t0 + start)
      osc.stop(t0 + start + dur + 0.05)
    }
  }

  /** A field cricket: bursts of 3–6 short pulses around 4–5 kHz, from somewhere in the meadow. */
  private cricket(voice: number) {
    const ctx = this.ctx
    if (!ctx) return
    const t0 = ctx.currentTime + 0.02
    const freq = 4300 + voice * 220 + Math.random() * 80
    const pan = ctx.createStereoPanner()
    pan.pan.value = [-0.7, 0.55, -0.2, 0.85][voice % 4]
    const level = ctx.createGain()
    level.gain.value = 0.018 + (voice % 2) * 0.008
    pan.connect(level).connect(this.ambientOut)
    const pulses = 3 + Math.floor(Math.random() * 4)
    for (let i = 0; i < pulses; i++) {
      const at = t0 + i * 0.045
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(1, at + 0.006)
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.03)
      osc.connect(g).connect(pan)
      osc.start(at)
      osc.stop(at + 0.035)
    }
  }

  private scheduleCricket(voice: number) {
    this.cricket(voice)
    // chirping comes in runs, with pauses
    const wait = Math.random() < 0.15 ? 2500 + Math.random() * 4000 : 380 + Math.random() * 260
    this.timers.push(window.setTimeout(() => this.scheduleCricket(voice), wait))
  }

  /** A distant Swiss cowbell: inharmonic metal partials, softened by distance, echoing in the valley. */
  private cowbell(voice: number) {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime + 0.02
    const f0 = [520, 610, 445][voice % 3] * (0.98 + Math.random() * 0.04)
    const pan = ctx.createStereoPanner()
    pan.pan.value = [-0.5, 0.35, 0.75][voice % 3]
    const distance = ctx.createBiquadFilter()
    distance.type = 'lowpass'
    distance.frequency.value = 2600
    const level = ctx.createGain()
    level.gain.value = 0.02 * (0.6 + Math.random() * 0.6)
    distance.connect(pan).connect(level)
    level.connect(this.ambientOut)
    level.connect(this.echo)
    for (const [ratio, amp, decay] of [
      [1, 1, 1.1],
      [2.76, 0.5, 0.7],
      [5.4, 0.25, 0.4],
      [8.93, 0.12, 0.25],
    ]) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f0 * ratio
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(amp, t + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0005, t + decay)
      osc.connect(g).connect(distance)
      osc.start(t)
      osc.stop(t + decay + 0.05)
    }
  }

  private scheduleCow(voice: number, clang = 0) {
    // a grazing cow: a few clangs as it steps, then a long quiet while it eats
    const moving = clang < 2 + Math.floor(Math.random() * 5)
    if (moving) this.cowbell(voice)
    const wait = moving ? 350 + Math.random() * 650 : 5000 + Math.random() * 14000
    this.timers.push(window.setTimeout(() => this.scheduleCow(voice, moving ? clang + 1 : 0), wait))
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
    this.windFilter.frequency.setTargetAtTime(420 + strength * 700, t, dur / 3)
    this.windPan.pan.setTargetAtTime((Math.random() - 0.5) * 1.2, t, dur / 2)
    this.timers.push(window.setTimeout(() => this.scheduleGust(), dur * 1000))
  }

  /** Your own marshmallow over the flames: 0 silent .. 1 full sizzle. */
  setSizzle(level: number) {
    if (!this.ctx || this.ctx.state !== 'running') return
    this.sizzle.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.035, this.ctx.currentTime, 0.2)
  }

  /** How close you are to the fire, 0..1 (used for other cozy cues). */
  get fireNearness() {
    return this.nearness
  }
}

export const audioEngine = new AudioEngine()
