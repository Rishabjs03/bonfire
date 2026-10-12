import { useState, type FormEvent } from 'react'
import { useProgress } from '@react-three/drei'
import { audioEngine } from '../audio/audioEngine'
import { enabled } from '../lib/debug'
import { randomName } from '../lib/names'
import { PALETTE } from '../lib/palette'
import { joinFire } from '../net/useMultiplayer'
import { MAX_NAME_LENGTH } from '../net/protocol'
import { useGameStore } from '../store/gameStore'
import { presenceLabel } from './presenceLabel'

export function JoinScreen() {
  const name = useGameStore((s) => s.name)
  const colors = useGameStore((s) => s.colors)
  const setColors = useGameStore((s) => s.setColors)
  const netStatus = useGameStore((s) => s.netStatus)
  const onlineCount = useGameStore((s) => s.onlineCount)
  const { active, progress } = useProgress()
  const [draft, setDraft] = useState(name)
  const ready = !active && progress >= 100

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    if (enabled('audio')) audioEngine.start() // inside the click: browsers only allow audio after a user gesture
    void joinFire(draft, colors)
  }

  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-gradient-to-t from-black/85 via-black/35 to-black/10 sm:items-center">
      <form onSubmit={submit} className="w-full max-w-sm px-6 pb-16 text-center font-serif text-stone-200/85 sm:pb-0">
        <h1 className="text-5xl font-light tracking-wide text-amber-50/90 sm:text-6xl">Bonfire</h1>
        <p className="mt-3 text-sm italic text-stone-300/70">a small fire in the Swiss Alps. come sit for a while.</p>
        <p className="mt-6 h-4 text-xs tracking-wide text-amber-200/70" aria-live="polite">
          {presenceLabel(netStatus, onlineCount, false)}
        </p>

        <div className="mt-8 flex items-center gap-2 border-b border-stone-400/25 focus-within:border-amber-200/50">
          <label htmlFor="name" className="sr-only">
            Your name
          </label>
          <input
            id="name"
            value={draft}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full bg-transparent py-2 pl-7 text-center text-lg text-amber-50/90 outline-none placeholder:text-stone-500"
            placeholder="your name"
          />
          <button
            type="button"
            onClick={() => setDraft(randomName())}
            className="w-5 shrink-0 text-stone-400/70 transition hover:text-amber-100"
            aria-label="Pick another name"
            title="Pick another name"
          >
            ↻
          </button>
        </div>

        <fieldset className="mt-6">
          <legend className="sr-only">Jacket colour</legend>
          <div className="flex justify-center gap-2.5">
            {PALETTE.map((p) => {
              const selected = p.body === colors.body
              return (
                <button
                  key={p.body}
                  type="button"
                  onClick={() => setColors(p)}
                  aria-label={`Jacket ${p.body}`}
                  aria-pressed={selected}
                  className={`grid h-7 w-7 place-items-center rounded-full transition ${
                    selected ? 'ring-1 ring-amber-100/80 ring-offset-2 ring-offset-black/40' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ background: p.body }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: p.hat }} />
                </button>
              )
            })}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={!ready}
          className="mt-9 rounded-full border border-amber-100/30 px-8 py-2.5 text-sm tracking-[0.2em] text-amber-50/90 transition hover:border-amber-100/60 hover:bg-amber-50/10 disabled:cursor-wait disabled:opacity-50"
        >
          {ready ? 'Join the fire' : `gathering firewood… ${Math.round(progress)}%`}
        </button>
        <p className="mt-10 text-[11px] text-stone-400/60">Riffelalp, above Zermatt · 2,110 m · the real Matterhorn on the horizon</p>
      </form>
    </div>
  )
}
