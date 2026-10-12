import { useEffect, useRef, useState } from 'react'
import { takePostcard } from '../lib/postcard'
import { useGameStore } from '../store/gameStore'

const TOAST_MS = 2600
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

/** A postcard from the fire: the current view with your name, the place and the date. P takes one too. */
export function PostcardButton() {
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef(0)
  const busyRef = useRef(false)

  const take = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setFlash(true)
    window.setTimeout(() => setFlash(false), 150)
    let message: string | null
    try {
      const outcome = await takePostcard(useGameStore.getState().name)
      message = outcome === 'saved' ? 'Postcard saved' : outcome === 'shared' ? 'Postcard shared' : null
    } catch {
      message = 'Couldn’t take the postcard'
    }
    busyRef.current = false
    setBusy(false)
    if (message) {
      setToast(message)
      window.clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS)
    }
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'KeyP' || e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (useGameStore.getState().phase !== 'joined') return
      e.preventDefault()
      void take()
    }
    window.addEventListener('keydown', down)
    return () => {
      window.removeEventListener('keydown', down)
      window.clearTimeout(toastTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- take reads live state via refs/store
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => void take()}
        disabled={busy}
        aria-label="Take a postcard (P)"
        title="Postcard (P)"
        className="panel absolute right-[3.75rem] top-4 z-10 grid h-9 w-9 place-items-center rounded-full text-ink-muted transition hover:text-ink disabled:text-ink-faint"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 8.5h3l1.5-2.5h7l1.5 2.5h3v10H4z" />
          <circle cx="12" cy="13.5" r="3.2" />
        </svg>
      </button>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-30 bg-white transition-opacity ${flash ? 'opacity-70 duration-0' : 'opacity-0 duration-300'}`}
      />
      {toast && (
        <div role="status" className="panel pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2 rounded-full px-4 py-2 text-[12.5px] font-medium text-ink">
          {toast}
        </div>
      )}
    </>
  )
}
