import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { chatCooldownLeft, sendChat } from '../net/useMultiplayer'
import { MAX_CHAT_LENGTH } from '../net/protocol'
import { clearPressedKeys } from '../player/useControls'
import { useGameStore } from '../store/gameStore'

export function ChatInput() {
  const open = useGameStore((s) => s.chatOpen)
  const setOpen = useGameStore((s) => s.setChatOpen)
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    clearPressedKeys() // don't keep walking with a key that was held when chat opened
    input.current?.focus()
  }, [open])

  if (!open) return null

  const close = () => {
    setOpen(false)
    setNote('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation()
    if (e.key === 'Escape') {
      setText('')
      return close()
    }
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!text.trim()) return close()
    if (sendChat(text)) {
      setText('')
      close()
    } else if (chatCooldownLeft() > 0) {
      setNote('a moment…')
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-20 z-10 flex justify-center px-4">
      <div className="w-full max-w-md">
        <label htmlFor="chat" className="sr-only">
          Say something
        </label>
        <input
          id="chat"
          ref={input}
          value={text}
          maxLength={MAX_CHAT_LENGTH}
          autoComplete="off"
          enterKeyHint="send"
          onChange={(e) => {
            setText(e.target.value)
            setNote('')
          }}
          onKeyDown={onKeyDown}
          onBlur={close}
          placeholder="say something…"
          className="w-full rounded-full border border-amber-100/20 bg-black/55 px-5 py-2.5 font-serif text-sm text-amber-50/90 outline-none backdrop-blur-sm placeholder:text-stone-400/70 focus:border-amber-100/40"
        />
        <div className="mt-1 flex justify-between px-4 font-serif text-[11px] text-stone-400/70">
          <span>{note || 'enter to send · esc to close'}</span>
          <span>
            {text.length}/{MAX_CHAT_LENGTH}
          </span>
        </div>
      </div>
    </div>
  )
}
