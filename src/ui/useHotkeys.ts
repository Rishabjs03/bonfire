import { useEffect } from 'react'
import { audioEngine } from '../audio/audioEngine'
import { sendEmote } from '../net/useMultiplayer'
import { useGameStore } from '../store/gameStore'
import { useRadioStore } from '../store/radioStore'
import { EMOTES, type EmoteKind } from '../store/socialStore'

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

const EMOTE_BY_KEY = Object.fromEntries(
  (Object.entries(EMOTES) as [EmoteKind, (typeof EMOTES)[EmoteKind]][]).map(([kind, e]) => [`Digit${e.key}`, kind]),
) as Record<string, EmoteKind>

/** Enter to chat, M to mute, 1–4 to emote. Ignored while typing. */
export function useHotkeys() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const { phase, setChatOpen } = useGameStore.getState()
      if (e.code === 'KeyM') {
        audioEngine.toggleMuted()
        return
      }
      if (phase !== 'joined') return
      if (e.code === 'KeyR' && (useRadioStore.getState().near || useRadioStore.getState().playing)) {
        e.preventDefault()
        const radio = useRadioStore.getState()
        radio.setOpen(!radio.open)
        return
      }
      if (e.code === 'Escape' && (useRadioStore.getState().open || useRadioStore.getState().playerExpanded)) {
        useRadioStore.setState({ open: false, playerExpanded: false })
        return
      }
      if (e.code === 'Enter') {
        e.preventDefault()
        setChatOpen(true)
      } else if (EMOTE_BY_KEY[e.code]) {
        sendEmote(EMOTE_BY_KEY[e.code])
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])
}
