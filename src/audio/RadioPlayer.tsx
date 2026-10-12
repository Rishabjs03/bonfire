import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RADIO } from '../lib/camp'
import { localRuntime, useGameStore } from '../store/gameStore'
import { useRadioStore } from '../store/radioStore'
import { audioEngine } from './audioEngine'
import { playableUrl } from './music'

const audio = typeof Audio !== 'undefined' ? new Audio() : null
if (audio) audio.preload = 'none'

/** Plays the chosen station through an <audio> element, quieter the further you walk from the radio. */
export function RadioPlayer() {
  const playing = useRadioStore((s) => s.playing)
  const volume = useRadioStore((s) => s.volume)
  const error = useRef(false)

  useEffect(() => {
    if (!audio) return
    if (!playing || playing.kind !== 'station') {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      return
    }
    error.current = false
    audio.src = playableUrl(playing.url)
    const onError = () => {
      error.current = true
      useRadioStore.setState({ error: 'This station won’t play here. Try another one.' })
    }
    audio.addEventListener('error', onError)
    audio.play().catch(onError)
    useRadioStore.setState({ error: null })
    return () => audio.removeEventListener('error', onError)
  }, [playing])

  useFrame(() => {
    if (!audio || !playing || playing.kind !== 'station') return
    const joined = useGameStore.getState().phase === 'joined'
    const p = localRuntime.position
    const d = joined ? Math.hypot(p.x - RADIO.x, p.z - RADIO.z) : 3
    // a little radio by the fire: full volume nearby, fading as you walk off into the meadow
    const proximity = Math.max(0.12, Math.min(1, 1.15 - d / 22))
    audio.volume = volume * proximity
    audio.muted = audioEngine.muted
  })

  return null
}
