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
      setNote('One moment…')
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-24 z-10 flex justify-center px-4">
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
          placeholder="Say something to the fire…"
          className="panel h-12 w-full rounded-full px-5 text-[14.5px] text-ink outline-none transition placeholder:text-ink-faint focus:border-ember/60"
        />
        <div className="mt-2 flex items-center justify-between px-5 text-[11.5px] text-ink-faint">
          <span className="flex items-center gap-1.5">
            {note || (
              <>
                <kbd className="kbd">↵</kbd> send <span className="mx-1">·</span> <kbd className="kbd">esc</kbd> close
              </>
            )}
          </span>
          <span className="tabular">
            {text.length}/{MAX_CHAT_LENGTH}
          </span>
        </div>
      </div>
    </div>
  )
}
